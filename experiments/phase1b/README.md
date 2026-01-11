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
- This code is intentionally minimal and should not be promoted to production.
