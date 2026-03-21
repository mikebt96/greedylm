from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from pydantic import BaseModel, EmailStr

from core.database import get_db
from core.models import User, UserAccessTier
from core.security.auth import get_password_hash, verify_password, create_access_token, settings
import httpx
from fastapi.responses import RedirectResponse
import secrets


router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    email: EmailStr
    role: str


class HumanCreate(BaseModel):
    email: EmailStr
    password: str
    username: str


class HumanResponse(BaseModel):
    user: dict
    message: str
    next_phase: str


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="OPERATOR",  # Default role
    )
    db.add(user)
    await db.commit()
    return user


@router.post("/register-human", response_model=HumanResponse)
async def register_human(user_in: HumanCreate, db: AsyncSession = Depends(get_db)):
    # 1. Check existing
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Create User
    user = User(email=user_in.email, password_hash=get_password_hash(user_in.password), role="SPECTATOR")
    db.add(user)
    await db.flush()  # Get user.id

    # 3. Create Tier
    tier = UserAccessTier(user_id=user.id, tier="spectator", granted_by="system")
    db.add(tier)
    await db.commit()

    # 4. Mock Email Verification handling
    print(f"[MAIL] Sending verification to {user.email}...")

    return {
        "user": {
            "username": user_in.username,
            "email": user.email,
            "tier": "spectator",
            "tier_label": "World Observer",
            "access": {
                "can_explore_world_3d": True,
                "can_read_social_feed": True,
                "can_interact_with_agents": False,
                "can_post_or_comment": False,
                "can_move_avatar": False,
            },
        },
        "message": "Welcome to GREEDYLM. The world is alive and you can watch it unfold.",
        "next_phase": "Full avatar access coming in the next update. Stay tuned.",
    }


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(days=settings.JWT_EXPIRE_DAYS)
    access_token = create_access_token(data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires)
    return {"access_token": access_token, "token_type": "bearer"}


# ── OAuth helpers ──────────────────────────────────────────────────────────────


async def _oauth_find_or_create_user(email: str, db: AsyncSession) -> User:
    """Find existing user by email or create a new SPECTATOR user."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(
        email=email,
        password_hash=get_password_hash(secrets.token_urlsafe(32)),  # random password for OAuth users
        role="SPECTATOR",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _create_redirect_with_token(user: User) -> RedirectResponse:
    """Create a redirect to the frontend with the JWT as a query parameter."""
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role},
        expires_delta=timedelta(days=settings.JWT_EXPIRE_DAYS),
    )
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?token={access_token}",
        status_code=302,
    )


# ── Google OAuth ───────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    redirect_uri = f"{settings.FRONTEND_URL.rstrip('/')}/api/v1/auth/google/callback"
    # Use the API's own URL for the callback
    api_base = "https://greedylm-api.onrender.com"
    redirect_uri = f"{api_base}/api/v1/auth/google/callback"
    return RedirectResponse(
        url=(
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            "&response_type=code"
            "&scope=openid%20email%20profile"
            "&access_type=offline"
        ),
        status_code=302,
    )


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    api_base = "https://greedylm-api.onrender.com"
    redirect_uri = f"{api_base}/api/v1/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        tokens = token_res.json()
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail="Google OAuth failed")

        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        user_info = user_res.json()

    user = await _oauth_find_or_create_user(user_info["email"], db)
    return _create_redirect_with_token(user)


# ── GitHub OAuth ───────────────────────────────────────────────────────────────

@router.get("/github")
async def github_login():
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")
    api_base = "https://greedylm-api.onrender.com"
    redirect_uri = f"{api_base}/api/v1/auth/github/callback"
    return RedirectResponse(
        url=(
            "https://github.com/login/oauth/authorize"
            f"?client_id={settings.GITHUB_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            "&scope=user:email"
        ),
        status_code=302,
    )


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        tokens = token_res.json()
        if "access_token" not in tokens:
            raise HTTPException(status_code=400, detail="GitHub OAuth failed")

        # Get user email
        user_res = await client.get(
            "https://api.github.com/user/emails",
            headers={
                "Authorization": f"Bearer {tokens['access_token']}",
                "Accept": "application/vnd.github+json",
            },
        )
        emails = user_res.json()
        primary_email = next(
            (e["email"] for e in emails if e.get("primary") and e.get("verified")),
            emails[0]["email"] if emails else None,
        )
        if not primary_email:
            raise HTTPException(status_code=400, detail="No verified email found on GitHub account")

    user = await _oauth_find_or_create_user(primary_email, db)
    return _create_redirect_with_token(user)

# ── End of Auth Routes ──

