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
