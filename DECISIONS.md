# DECISIONS

## Phase 1 Feasibility Decisions

| Date | Decision | Rationale | Status |
| --- | --- | --- | --- |
| 2026-01-05 | Use Google Photos Library API v1 with `photoslibrary.readonly` scope for feasibility probes. | Aligns with Phase 1 constraints and limits to read-only access. | Approved |
| 2026-01-05 | Store OAuth tokens encrypted at rest in `experiments/phase1/.tokens/`. | Prevents plaintext token storage during probes. | Approved |
| 2026-01-05 | Run feasibility probes only from `experiments/phase1/`. | Keeps spike code disposable and scoped. | Approved |
| 2026-01-06 | Library API cannot enumerate user libraries; only app-created items accessible. Whole-library scan via Library API is not viable. | API access is constrained to app-created content, blocking full-library enumeration. | Approved |
| 2026-01-07 | Run Phase 1b feasibility probe using the Google Photos Picker API session flow. | Validate selection scale, metadata completeness, and URL behavior with user-picked media. | Approved |
