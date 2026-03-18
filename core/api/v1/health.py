from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from datetime import datetime
from circuitbreaker import circuit
from sqlalchemy import text
from core.database import engine
from core.config import settings
import redis.asyncio as redis

router = APIRouter()


async def check_database():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "healthy"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


async def check_redis():
    try:
        r = redis.from_url(settings.REDIS_URL)
        await r.ping()
        return {"status": "healthy"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.get("/health")
async def health_check():
    """
    Production health check.
    Verifies DB and Redis. Returns 503 if critical deps are down.
    """
    db_status = await check_database()
    redis_status = await check_redis()

    is_healthy = db_status["status"] == "healthy" and redis_status["status"] == "healthy"

    content = {
        "status": "healthy" if is_healthy else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "7.0.0",
        "checks": {"database": db_status, "redis": redis_status},
    }

    return JSONResponse(
        content=content, status_code=status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )


# Circuit Breaker Example for External AI API
@circuit(failure_threshold=5, recovery_timeout=60)
async def call_external_llm(provider: str, prompt: str):
    """
    If the external provider fails 5 times, the circuit opens for 60s.
    """
    # Logic to call external API...
    pass
