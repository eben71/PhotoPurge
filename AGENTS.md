# AGENTS.md

## Purpose
This file instructs development agents (e.g., CODEX) and reviewers on how to produce
**secure, clean, testable, and maintainable code** for the PhotoPrune codebase.

Primary goals:
- Secure coding by default
- Clean, well-structured code
- Meaningful tests with **repo-wide ≥ 80% coverage**
- Sensible dependency management
- Green CI/CD at all times
- Living documentation that evolves with the codebase

Non-goals:
- Shipping code that “just works” but is unsafe, untested, or undocumented
- Over-testing or cargo-cult testing patterns

---

## Hard Quality Gates (Non-Negotiable)

A change must NOT be merged if any of the following fail:

1. Security standards (see below)
2. Code quality standards
3. Repo-wide test coverage below **80%**
4. CI/CD pipeline not fully green
5. Documentation not updated when behavior, APIs, or architecture changes

---

## Security Standards (Must Follow)

### Secrets & Sensitive Data
- **Never** commit or log:
  - API keys
  - OAuth authorization codes
  - Access tokens
  - Refresh tokens
  - Encryption keys
- Secrets must come from environment variables or a secrets manager.
- Logs must be scrubbed of PII and sensitive metadata.

### OAuth / Authentication
- Treat OAuth and identity flows as **high-risk**.
- Refresh tokens:
  - must be encrypted at rest
  - must not be overwritten if a provider omits a refresh token on renewal
- Validate:
  - redirect URIs
  - `state` parameters (anti-CSRF)
  - token expiry and refresh failure paths
- Never log token payloads or decoded JWTs.

### Data Protection
- Treat as sensitive:
  - user identifiers
  - photo metadata (including EXIF/location data)
  - embeddings, hashes, perceptual fingerprints
- Store only what is required for the feature.
- Provide deletion paths (at least internal/admin) for user data.

### Crypto Rules
- Do not invent cryptography.
- Use well-known, actively maintained libraries.
- Use authenticated encryption where applicable.
- Keys must be rotatable and externalized.

---

## Code Quality & Structure

- Prefer small, focused functions.
- Avoid “god files” and excessive conditional logic.
- Maintain clear boundaries:
  - API layer: request/response + orchestration only
  - Services: business logic
  - Persistence: repositories/DAOs only
  - Workers: idempotent background execution
- Remove dead code, commented-out blocks, and unresolved TODOs.
- Use consistent patterns for:
  - configuration access
  - logging
  - error handling

---

## Testing Strategy

### Core Principles
- **Repo-wide coverage must remain ≥ 80%**
- Tests must be **appropriate to the change**
- Do **not** over-test
- Do **not** under-test
- If unsure which test type applies, **pause and discuss**

### Test Types (Use the Right Tool)

#### Unit Tests
Use when:
- Logic is deterministic
- No I/O or infrastructure dependency
- Pure functions or small business rules

#### Integration Tests
Use when:
- Code interacts with databases, queues, file systems, or APIs
- Verifying boundaries between major components
Avoid when:
- The logic can be validated with unit tests alone

#### Worker / Background Job Tests
- Validate idempotency
- Validate retry behavior
- Ensure safe re-execution

#### E2E / Smoke Tests
Use **sparingly**, only for:
- Critical user journeys
- Authentication flows
- Destructive operations (e.g. deletion)

### External Services
- No live external calls in CI
- Use mocks or fixtures
- Validate contract expectations (payload shapes, error cases)

### When Tests Are Hard
If something is difficult to test:
- Document **why**
- Describe alternative validation performed
- Get explicit agreement before merging

---

## Coverage Policy

- Coverage is enforced **repo-wide**, not per-package.
- Artificial coverage inflation (testing trivial lines only) is not acceptable.
- Coverage drops must be justified and explicitly approved.

---

## Dependency Management

- Prefer **latest stable** versions.
- Avoid adding new dependencies unless clearly justified.
- For new dependencies:
  - explain why existing ones are insufficient
  - confirm license compatibility
  - confirm active maintenance and security posture
- Opportunistically upgrade patch/minor versions when touching an area.
- Large or risky upgrades should be isolated into separate PRs unless requested.

---

## CI/CD Expectations

A PR must pass:
- linting
- formatting
- type checks (if applicable)
- unit/integration tests
- coverage gate (≥ 80%)
- build (frontend/backend as applicable)
- security checks if configured

Never bypass or weaken CI gates to “get it through”.

---

## Documentation Is Mandatory

Documentation must be updated when code changes affect:
- public APIs
- authentication flows
- configuration
- architecture
- operational behavior
- developer workflows

Minimum expectations:
- `README.md` kept current
- `.env.example` updated for new config
- Architecture or flow changes documented inline or in `/docs`
- Breaking changes clearly called out

Code that changes behavior **without updating documentation is incomplete**.

---

## Review Workflow (Agent Checklist)

1. Understand scope and intent
2. Threat-model the change
3. Trace execution paths (success + failure)
4. Validate data integrity and lifecycle
5. Review test coverage and test choice
6. Run locally (mirror CI as closely as possible)
7. Verify documentation updates

---

## Common Blockers (Must Be Fixed)

- Secrets or PII in logs or code
- Lost or overwritten refresh tokens
- Missing timeouts or retries on external calls
- Non-idempotent workers
- Silent exception swallowing
- Disabling lint/tests to pass CI
- Behavior changes without documentation updates

---

## Review Output Format

Use:
- Severity: High / Medium / Low
- Location: file:line
- Risk: what could break or leak
- Fix: concrete recommendation

Conclude with:
- Blockers to merge
- Non-blocking improvements
- Open questions / assumptions

---

## Ready-to-Merge Checklist

- [ ] Security rules followed
- [ ] Clean, maintainable structure
- [ ] Appropriate tests added
- [ ] Repo-wide coverage ≥ 80%
- [ ] Dependencies justified and stable
- [ ] CI fully green
- [ ] README and docs updated
- [ ] Config examples updated
- [ ] Background jobs safe and idempotent (if applicable)

---

## Final Rule
If something feels ambiguous, risky, or unclear:
**Stop and ask. Quality over speed, always.**