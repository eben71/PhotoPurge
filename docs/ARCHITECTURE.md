# Architecture (Phase 0 skeleton)

## Services
- **Web (`apps/web`)**: Next.js app serving the UI. Uses shared Zod schemas for cross-service contracts. Development uses `NEXT_PUBLIC_API_BASE_URL` to call the API `/healthz` endpoint.
- **API (`apps/api`)**: FastAPI application exposing `/healthz`. Configuration uses Pydantic Settings to read environment variables for database, Redis, and CORS origins. CORS is permissive for local development only.
- **Worker (`apps/worker`)**: Celery worker connected to Redis. Includes a demo `ping` task to validate wiring.

## Infrastructure & tooling
- **Docker Compose** provisions PostgreSQL, Redis, web, API, and worker services for local development. Healthchecks ensure dependencies are ready before application start.
- **Monorepo** managed via Turborepo + pnpm for JS/TS packages; Python services use `uv` with pinned requirement files.
- **Shared package** (`packages/shared`) holds common schemas/types to avoid duplication between web and backend.
