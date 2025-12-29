FROM python:3.12-slim AS base

SHELL ["/bin/bash", "-c"]

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENV=.venv

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY apps/worker/requirements.lock ./requirements.lock
RUN uv venv /app/.venv && uv pip install -r requirements.lock

COPY apps/worker ./app

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uv", "run", "celery", "-A", "app.celery_app.app", "worker", "-l", "info"]
