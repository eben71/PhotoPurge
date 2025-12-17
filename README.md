# PhotoPrune

PhotoPrune helps you safely **find and remove duplicate / near-duplicate photos** by scanning libraries, grouping matches, and guiding a careful review workflow before deletion.

## Tech stack (proposed)

- **Frontend:** Next.js + React + TypeScript  
- **UI:** TailwindCSS + shadcn/ui  
- **Data fetching:** TanStack Query  
- **Client state:** Zustand  
- **Validation:** Zod  
- **Backend API:** Python + FastAPI  
- **Worker:** Celery  
- **Queue/Broker:** Redis  
- **Database:** PostgreSQL (optional: pgvector later)  
- **Object storage:** S3-compatible (Cloudflare R2 or AWS S3)  
- **Local dev:** Docker Compose  
- **Monorepo:** Turborepo  
- **CI:** GitHub Actions  
- **Testing:** Vitest (FE), Playwright (E2E), pytest (BE/worker)

## Proposed repo structure (monorepo)

```
/
  apps/
    web/            # Next.js web app
    api/            # FastAPI service
    worker/         # Celery workers (image scanning/processing)
  tests/
    integration/
      web/
      api/
      worker/
    unit/
      web/
      api/
      integration/
    e2e/
      web/
      api/
    helpers/
    fixtures/
  packages/
    shared/         # shared types/schemas (e.g., Zod schemas, API contracts)
  infra/
    docker/         # docker-compose, local dev tooling
    terraform/      # IaC once deployment is stabilized
  docs/
    architecture/   # ADRs, diagrams, decisions
  .github/
    workflows/      # CI pipelines
```

## MVP scope

- Auth (email/password or OAuth) + user isolation
- Upload photos (direct-to-object-store via presigned URLs)
- Scan jobs (async) to compute:
  - exact hashes + perceptual hashes (pHash)
  - basic metadata extraction (dimensions, size, timestamps)
- Duplicate grouping + review UI:
  - compare items, choose âkeepâ vs âremoveâ
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