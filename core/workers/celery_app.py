from celery import Celery
import os
from core.config import settings

# ── Celery App Configuration ───────────────────────────────────────────────────
# We use Redis as both the broker and the result backend.
celery_app = Celery(
    "greedylm",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "core.modules.cse.streaming_engine",
        "core.modules.ccf.sandbox"
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

if __name__ == "__main__":
    celery_app.start()
