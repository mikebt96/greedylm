import time
import json
import redis.asyncio as redis
from fastapi import Request, HTTPException
from core.config import settings

class RateLimiter:
    """
    Production Rate Limiter for GREEDYLM.
    Scales limits dynamically based on agent DID and Trust Score.
    """
    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Default limits: actions per hour
        self.DEFAULT_LIMITS = {
            "register": 5,    # registration is very restricted
            "ingest": 100,
            "search": 500,
            "synthesize": 50,
            "social_post": 200,
            "forge_proposal": 10
        }

    async def check_limit(self, identifier: str, action: str, trust_score: float = 0.0) -> bool:
        """
        Check if an action is within limits for a given identifier (DID or IP).
        Trust score logic: 
        - Score < 3: 0.5x multiplier (restricted)
        - Score > 7: 2x multiplier (trusted)
        - Score > 9: 5x multiplier (core nodes)
        """
        base_limit = self.DEFAULT_LIMITS.get(action, 100)
        
        # Scale multiplier
        multiplier = 1.0
        if trust_score < 3.0: multiplier = 0.5
        elif trust_score >= 9.5: multiplier = 10.0
        elif trust_score >= 9.0: multiplier = 5.0
        elif trust_score >= 7.0: multiplier = 2.0
        
        limit = int(base_limit * multiplier)
        key = f"rate_limit:{identifier}:{action}"
        
        current_count = await self.redis.get(key)
        
        if current_count and int(current_count) >= limit:
            return False
            
        async with self.redis.pipeline(transaction=True) as pipe:
            await pipe.incr(key)
            await pipe.expire(key, 3600)  # Reset every hour
            await pipe.execute()
            
        return True

limiter = RateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    # This is a simplified middleware. 
    # In production, specific routes would use dependencies to get the agent_did.
    return await call_next(request)
