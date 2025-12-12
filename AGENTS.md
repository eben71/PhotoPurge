# AGENTS.md

## Purpose
This file guides CODEX, GEMINI or CLAUDE agents working on pull requests for the Photo Purge project. 
The goal is consistent, high-quality reviews that protect OAuth flows, data security, and ingestion reliability.

## System Snapshot
to be confirmed

## Review Priorities
to be confirmed

## Review Workflow
- **Scope first**: Skim PR description, verify linked issues, and inspect touched files to understand intent.
- **Static thinking**: Trace code paths for regressions, security leaks, concurrency issues, and data races.
- **Cross-check configuration**: Ensure new settings or env vars are documented (`README.md`, `.env.example`, `settings.py`).
- **Database focus**: For model changes, require matching Alembic migration and test coverage.
- **Background workers**: Verify Celery tasks stay idempotent, handle retries, and close sessions.
- **Frontend updates**: Confirm API contracts stay compatible (response shapes, status codes) and update shared schemas as needed.

## Testing Expectations
- Run or request `pytest` where feasible (`make tests` or `pytest`).
- For OAuth integrations, prefer respx or AsyncMock-based tests over live calls.
- When logic touches DB state, ensure fixtures create/cleanup SQLModel metadata.
- If a PR cannot be tested (e.g., missing env or external service), document why and suggest alternatives.

## Common Pitfalls to Flag
- Forgetting to reset `requires_reauth` on successful token refresh/login.
- Using POST instead of GET for Google userinfo, or awaiting synchronous `response.json()`.
- Not preserving existing refresh tokens when Google omits them on refresh.
- Setting mutable default arguments or sharing sessions across async contexts.
- Introducing migrations without updating SQLModel models (and vice versa).
- Logging secrets or creating duplicate logger configuration.

## Review Output Style
- Lead with high-severity findings (security, data loss, or runtime breakages) referencing `path:line`.
- Use clear severity labels (High/Medium/Low) and explain risk + fix suggestion.
- Highlight missing tests or documentation updates explicitly.
- Close with outstanding questions or confirmation that blockers are resolved.

## Ready-to-Merge Checklist
- [ ] All blocking findings addressed or explained.
- [ ] Tests added/updated and passing locally or in CI.
- [ ] Migrations (if any) align with model changes.
- [ ] Docs/config refreshed for new settings or behaviors.
- [ ] Secrets remain encrypted and OAuth flows are healthy.
