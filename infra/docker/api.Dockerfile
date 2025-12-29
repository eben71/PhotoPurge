FROM python:3.12-slim AS base

SHELL ["/bin/bash", "-c"]

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENV=.venv

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast installs
RUN pip install --no-cache-dir uv

COPY apps/api/requirements.lock ./requirements.lock
RUN uv venv /app/.venv && uv pip install -r requirements.lock

COPY apps/api ./app

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
