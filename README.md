# PhotoPrune

PhotoPrune helps you safely **find and remove duplicate / near-duplicate photos** by scanning libraries, grouping matches, and guiding a careful review workflow before deletion. Phase 0 delivers the disciplined skeleton only—no product logic is implemented yet.

## Tech stack (current)

- **Frontend:** Next.js + React + TypeScript
- **Backend API:** Python + FastAPI
- **Worker:** Celery (Redis broker)
- **Queue/Broker:** Redis
- **Database:** PostgreSQL
- **Validation:** Zod (shared types)
- **Monorepo:** Turborepo + pnpm workspaces
- **CI:** GitHub Actions
- **Testing:** Vitest (FE), pytest (API/worker)
- **Lint/Format/Typecheck:** ESLint/Prettier, Ruff/Black, MyPy

## Repo Structure

- `apps/web` — Next.js app with a basic home page and `/health` check that calls the API
- `apps/api` — FastAPI service exposing `/healthz` and loading settings from env
- `apps/worker` — Celery worker with a demo `ping` task
- `packages/shared` — Shared Zod schemas/types (e.g., health payload)
- `infra/docker` — Dockerfiles used by local Docker Compose services
- `docs` — Architecture and contributing guides
- `.github/workflows` — CI pipelines and checks

## Local Development

Prereqs: Node.js 20+, pnpm (via Corepack), Python 3.12+, and `uv`.

1. Copy `.env.example` to `.env` and adjust if needed.
2. Install dependencies and toolchains:
   ```bash
   make setup
   ```
3. Common tasks:
   ```bash
   make dev       # docker compose up web/api/worker + services
   make lint      # lint JS/TS (pnpm) + Ruff
   make format    # apply Prettier + Black
   make format-check  # formatting check only
   make typecheck # TypeScript + MyPy
   make test      # Vitest + pytest (with coverage)
   make build     # Turbo builds + Python bytecode compile
   make hooks     # install git hooks via lefthook
   ```
4. If you regenerate lockfiles (e.g., after dependency changes), commit the updated `pnpm-lock.yaml` and requirement locks so CI stays reproducible.

## MVP scope

- Auth (email/password or OAuth) + user isolation
- Upload photos (direct-to-object-store via presigned URLs)
- Scan jobs (async) to compute:
  - exact hashes + perceptual hashes (pHash)
  - basic metadata extraction (dimensions, size, timestamps)
- Duplicate grouping + review UI:
  - compare items, choose “keep” vs “remove”
  - safe delete workflow (soft-delete / trash first)
- Job status + progress (polling)
- Basic admin tooling (health endpoints, job retry)

## Out of scope (initially)

- Embedding similarity search (CLIP/OpenCLIP) and semantic clustering
- Realtime updates via websockets (Socket.io)
- Product analytics (PostHog) and error tracking (Sentry)
- Payments / subscriptions
- Mobile apps
- Multi-region, multi-cloud portability work

## Notes

- No secrets are committed. Use `.env.example` as a template and provide values locally.
- CI enforces linting, formatting, type checking, tests, coverage (>=80%), doc guard, and audits.
- The checked-in `pnpm-lock.yaml` is a placeholder due to offline bootstrapping; regenerate with `pnpm install` when network access is available and commit the result.
