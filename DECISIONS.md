# DECISIONS

## Phase 1 Feasibility Decisions

| Date | Decision | Rationale | Status |
| --- | --- | --- | --- |
| 2026-01-05 | Use Google Photos Library API v1 with `photoslibrary.readonly` scope for feasibility probes. | Aligns with Phase 1 constraints and limits to read-only access. | Approved |
| 2026-01-05 | Store OAuth tokens encrypted at rest in `experiments/phase1/.tokens/`. | Prevents plaintext token storage during probes. | Approved |
| 2026-01-05 | Run feasibility probes only from `experiments/phase1/`. | Keeps spike code disposable and scoped. | Approved |
| 2026-01-06 | Library API cannot enumerate user libraries; only app-created items accessible. Whole-library scan via Library API is not viable. | API access is constrained to app-created content, blocking full-library enumeration. | Approved |
| 2026-01-07 | Run Phase 1b feasibility probe using the Google Photos Picker API session flow. | Validate selection scale, metadata completeness, and URL behavior with user-picked media. | Approved |

## Phase 2 Locked Decisions (Validation MVP)

| Date | Decision | Rationale | Status |
| --- | --- | --- | --- |
| 2026-01-12 | No library-wide scanning; Picker API only. | Feasibility and trust constraints require user-selected ingestion. | Locked |
| 2026-01-12 | No automatic deletion in MVP. | Trust-first validation requires review-only output. | Locked |
| 2026-01-12 | No embeddings in MVP. | Cost + complexity risk; not required for validation. | Locked |
| 2026-01-12 | Tiered similarity pipeline: metadata → perceptual hash → optional byte hash. | Balances cost control with explainable confidence. | Locked |
| 2026-01-12 | Environment-based cost guardrails (per-run item caps). | Prevents unexpected usage spikes during validation. | Locked |

## Phase 2.1 Implementation Decisions (Core Engine)

| Date | Decision | Rationale | Status |
| --- | --- | --- | --- |
| 2026-01-15 | Implement the Phase 2.1 core engine in the FastAPI service using Python. | Keeps scan execution server-side for cost control and aligns with the existing backend stack. | Approved |
| 2026-01-15 | Use Pillow for deterministic image decoding and dHash/pHash generation. | Provides stable, maintained image handling for perceptual hashing without bespoke codecs. | Approved |

## Deferred Decisions (TODO: Phase 3)

| Decision | Rationale | Status |
| --- | --- | --- |
| Pricing model | Requires post-validation signal and usage data. | TODO (Phase 3) |
| Free tier enforcement | Depends on pricing and cost envelope decisions. | TODO (Phase 3) |
| Long-term hosting approach | To be decided after validation MVP outcome. | TODO (Phase 3) |
