FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (core/requirements.txt is the one in dockerContext)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy core/ contents into /app/core/ so `import core.xxx` works
COPY . ./core/

# PYTHONPATH=/app ensures `import core.main` resolves to /app/core/main.py
ENV PYTHONPATH=/app

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app
USER appuser


EXPOSE 8000

# Run from /app (NOT /app/core) — core.main resolves to /app/core/main.py
CMD ["sh", "-c", "uvicorn core.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
