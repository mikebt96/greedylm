import re
from fastapi import HTTPException, status
from core.models import User, UserAccessTier
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

class AccessControl:
    ALLOWED_PATTERNS = {
        "spectator": [
            r"^GET /api/v1/world/.*",           # World observation
            r"^GET /api/v1/cb/feed",            # Read social feed (aliased as social/feed in prompt)
            r"^GET /api/v1/collective/mythology", # Read myths
            r"^GET /api/v1/collective/trending",  # Trending topics
            r"^GET /api/v1/collective/emotions",  # Emotional heatmap
            r"^GET /api/v1/collective/relationships", # Relationship graph
            r"^GET /api/v1/collective/civilizations.*", # Listed civilizations
            r"^GET /api/v1/agents/.*/profile",  # Public profiles (if implemented)
            r"^GET /api/v1/agents$",            # List agents
            r"^GET /api/v1/collective/state",   # Cultural state
            r"^GET /api/v1/sentinel/report/latest", # Public reports
            r"^GET /api/v1/system/.*"           # System health/status
        ],
        "visitor": [
            # TBD - Future Phase 2
        ]
    }

    @staticmethod
    async def get_user_tier(user: User, db: AsyncSession) -> str:
        if user.role == "ADMIN":
            return "admin"
        
        result = await db.execute(
            select(UserAccessTier.tier)
            .where(UserAccessTier.user_id == user.id)
            .order_by(UserAccessTier.granted_at.desc())
        )
        tier = result.scalar_one_or_none()
        return tier or "spectator" # Fallback to spectator if not found

    @staticmethod
    def is_action_allowed(tier: str, method: str, path: str) -> bool:
        if tier == "admin":
            return True
        
        action_str = f"{method} {path}"
        patterns = AccessControl.ALLOWED_PATTERNS.get(tier, [])
        
        for pattern in patterns:
            if re.match(pattern, action_str):
                return True
        
        return False

    @staticmethod
    def check_spectator_restrictions(user_tier: str, method: str, path: str):
        if user_tier == "spectator":
            if not AccessControl.is_action_allowed(user_tier, method, path):
                # Bloquear silenciosamente con mensaje amigable
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This feature is coming soon for human visitors. For now, explore and observe — the world has a lot to show you."
                )

access_control = AccessControl()
