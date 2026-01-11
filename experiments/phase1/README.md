# Phase 1 Feasibility Probe (Disposable)

**DO NOT REUSE THIS CODE**

This directory contains disposable experiments to validate the Google Photos Library API
constraints during Phase 1. It is intentionally minimal and should be safe to delete after
feasibility is decided.

## Safety Checklist (Mandatory)

- Tokens are encrypted at rest in `experiments/phase1/.tokens/`.
- **Verification step:** After auth, run `git status` and confirm no token files are staged.
- Never commit or log access/refresh tokens.

## Setup

1. Ensure `.env.example` values are configured in your environment (a repo-root `.env` is auto-loaded if present):
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `REDIRECT_URI`
2. Optional: set `TOKEN_PASSWORD` to avoid interactive prompts.

## Run the scan probe

```bash
set -a; source .env; set +a; node experiments/phase1/src/scan.js --tier test --token-id default
set -a; source .env; set +a; node experiments/phase1/src/scan.js --tier small --token-id default
set -a; source .env; set +a; node experiments/phase1/src/scan.js --tier medium --token-id default
set -a; source .env; set +a; node experiments/phase1/src/scan.js --tier large --token-id default
```

### Optional flags

- `--max-items <n>`: override tier size
- `--output-prefix <name>`: custom run artifact prefix
- `--save-baseline`: write `*-baseline-ids.ndjson` for diffing
- `--search-since YYYY-MM-DD`: use `mediaItems.search` with date filters

## URL expiry checks

```bash
node experiments/phase1/src/url-expiry-check.js --run-file experiments/phase1/runs/<run>.json --token-id default --label T+0
```

## Baseline diff

```bash
node experiments/phase1/src/diff-baseline.js --a experiments/phase1/runs/<run>-baseline-ids.ndjson --b experiments/phase1/runs/<run2>-baseline-ids.ndjson
```

## Notes

- Run artifacts are written to `experiments/phase1/runs/` and are **gitignored**.
- This code is intentionally minimal and should not be promoted to production.

## Troubleshooting empty output

If the scan completes but `*-items.ndjson` is empty, use the `[diag]` logs to narrow down the cause:

- `mediaItems.list keys=... mediaItems=missing|0` means the API response did not include `mediaItems` or it was empty.
- `mediaItems.list ... nextPageToken=[present]` with a repeated token triggers a hard error to avoid infinite loops.
- `wrote 0 items this page; filtered reasons=...` means items were returned but none were written (e.g., max-items reached or future filters).
- The summary line reports total pages, total mediaItems received, total items written, and output file size.

Common causes:

- **No app-created items**: Under `appcreateddata` scope, Google Photos only returns items created by this app. If none exist, totals stay at zero.
- Filtering or max-items limits: ensure `--max-items` and tier limits allow writes.
- Pagination issues: a repeated `nextPageToken` now stops the run with an explicit error.

Next steps:

- Verify your app has created media in the library (upload via this app).
- Try `--search-since YYYY-MM-DD` to confirm `mediaItems.search` returns items.
- Inspect the `[diag]` summary to confirm whether the API returned items vs. writes were filtered.

## Empty output / endless paging

When the API returns consecutive pages with no `mediaItems`, the scan now aborts early with
`termination_reason: "empty_pages_threshold"` in the run JSON. This protects against hundreds of
requests with zero items.

- Default `--empty-page-limit` is **5** for the `test` tier and **20** for all other tiers.
- Override it when needed: `--empty-page-limit 50`.
- If you typically see zero items, remember that the `appcreateddata` scope only returns items
  created by this app; most users will have no results unless the app has uploaded media.
