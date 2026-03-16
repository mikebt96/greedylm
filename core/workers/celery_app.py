from celery import Celery
from core.config import settings

# ── Celery App Configuration ───────────────────────────────────────────────────
# We use Redis as both the broker and the result backend.
celery_app = Celery(
    "greedylm",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "core.modules.cse.streaming_engine",
        "core.modules.ccf.sandbox",
        "core.workers.world_tick",
        "core.workers.daily_tasks"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "rewards-every-day": {
            "task": "daily_agent_rewards",
            "schedule": 86400.0, # Every 24 hours
        },
        "civilization-nightly": {
            "task": "nightly_civilization_update",
            "schedule": 86400.0,
        }
    }
)

if __name__ == "__main__":
    celery_app.start()
