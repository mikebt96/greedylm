#!/bin/bash

# Start the health check server in the background
python3 core/workers/health.py &

# Start the Celery worker
celery -A core.workers.celery_app worker --loglevel=info --concurrency=2
