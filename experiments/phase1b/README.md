# Phase 1b Picker Feasibility Probe (Disposable)

**DO NOT REUSE THIS CODE**

This directory contains disposable experiments to validate whether the Google Photos
Picker API can provide enough access for PhotoPrune. It is intentionally minimal and
should be safe to delete after feasibility is decided.

## Safety Checklist (Mandatory)

- Tokens are encrypted at rest in `experiments/phase1b/.tokens/`.
- **Verification step:** After auth, run `git status` and confirm no token files are staged.
- Never commit or log access/refresh tokens.

## Setup

1. Ensure `.env` values are configured in your environment (a repo-root `.env` is auto-loaded if present):
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `REDIRECT_URI`
2. Optional: set `TOKEN_PASSWORD` to avoid interactive prompts.

## Run the picker probe

> **Note:** If you change OAuth scopes, delete cached tokens in `experiments/phase1b/.tokens/`
> and re-consent so the new scopes take effect.

```bash
set -a; source .env; set +a; node experiments/phase1b/src/picker.js --tier test --token-id default
set -a; source .env; set +a; node experiments/phase1b/src/picker.js --tier small --token-id default
set -a; source .env; set +a; node experiments/phase1b/src/picker.js --tier large --token-id default
```

### Optional flags

- `--max-item-count <n>`: override tier maximum item count (capped at 2000 by the API)
- `--output-prefix <name>`: custom run artifact prefix
- `--sample-size <n>`: override URL probe sample size (default 25)

## URL re-check (T+15)

```bash
node experiments/phase1b/src/url-recheck.js --run-file experiments/phase1b/runs/<run>-run.json --token-id default --label T+15
```

## Notes

- Run artifacts are written to `experiments/phase1b/runs/` and are **gitignored**.
- If the NDJSON self-check fails, the run aborts with an error. This indicates the
  items writer produced invalid output.
- Metadata fields may be nested under `mediaFile` in the Picker API response.
- URL probe notes: Picker `baseUrl` requests must include an `Authorization` header
  and the correct suffix (`=d` for images, `=dv` for video). If either is missing,
  403s are expected.
- Similarity probe (TEST/SMALL tiers only) computes a lightweight perceptual hash
  for each image and reports pairwise “% similarity” as a heuristic score. This is
  **not** a proof of exact duplicates; exact matches still require SHA-256 over
  downloaded bytes.
- After a successful similarity probe, the picker run auto-generates a static HTML
  report under `experiments/phase1b/reports/<runId>/report/index.html`.
- The report generator will download thumbnails when `PHASE1B_REPORT_ACCESS_TOKEN` is
  available. Use `--noDownloadImages` to skip caching.
- This code is intentionally minimal and should not be promoted to production.
