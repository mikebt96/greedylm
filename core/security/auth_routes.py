from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from pydantic import BaseModel, EmailStr

from core.database import get_db
from core.models import User, UserAccessTier
from core.security.auth import get_password_hash, verify_password, create_access_token, settings

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
