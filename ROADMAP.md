# PhotoPrune — MVP Roadmap (LLM-Resistant, MVP-First)

> **Purpose**  
> This roadmap defines the minimum phases required to validate PhotoPrune as a product.
> It prioritises **early validation of Google Photos constraints**, **user trust**, and **speed to MVP** over architectural elegance.
>
> ⚠️ Any suggestion that increases scope without improving MVP validation should be treated as **post-MVP**.

---

## 0 — Phase 0: Project Foundation, Repo Setup & CI Baseline (NO PRODUCT LOGIC)

> **Goal:** Create a clean, disciplined workspace so MVP work can start without rework.

### Repository & Project Scaffolding
- ✅ Initialise mono-repo (frontend + backend, clear separation)
- ✅ Define top-level folder structure
- ✅ Add `.gitignore`, `.editorconfig`
- ✅ Add `.env.example` (no secrets, just placeholders)
- ✅ Define local dev commands (documented in README)
  - ✅ `dev` (run locally)
  - ✅ `lint`
  - ✅ `test`
  - ✅ `build`

### Documentation Skeleton (Minimal but Real)
- ✅ `README.md` (what it is, what it is not, MVP scope boundaries)
- ✅ `ROADMAP.md` (this file)

### Code Quality Baseline (Local)
- ✅ Linting configured (language-appropriate)
- ✅ Formatting rules enforced
- ✅ Type checking enabled (if applicable)
- ✅ Pre-commit hooks (lint + format only)

### CI/CD Baseline (Starts Now)
- ✅ CI pipeline runs on every PR and on main branch updates
- ✅ CI steps (PR gate):
  - ✅ Install dependencies
  - ✅ Lint (fail = block merge)
  - ✅ Format check (fail = block merge)
  - ✅ Type check (if applicable)
  - ✅ Build frontend
  - ✅ Build backend
- [ ] Branch protection enabled:
  - [ ] Required checks must pass before merge
  - [ ] No direct pushes to main

### Guardrails (Prevent Roadmap Drift)
- ✅ MVP scope explicitly written in README
- ✅ “Out of scope” list included to prevent drift
- [ ] No infrastructure provisioning in this phase
- [ ] No product logic implemented in this phase

**Exit Criteria**
- Repo can be cloned and skeleton can run/build locally
- CI is green and required for merge
- Docs exist and clearly constrain scope

---

## 1 — Phase 1: Feasibility & Risk Validation (EARLIEST GATE)

> **Goal:** Prove Google Photos is viable **before** building the product.

### Google Photos API Validation (Critical)
- [ ] OAuth flow works end-to-end
- [ ] Fetch full library (pagination, large accounts)
- [ ] Measure under realistic conditions:
  - [ ] API rate limits encountered during scan
  - [ ] Time to scan 10k / 50k photos
  - [ ] Metadata completeness (IDs, URLs, timestamps, dimensions where available)
- [ ] Validate expiring media URL behaviour (how often you need to refresh access)
- [ ] Confirm incremental scan strategy feasibility (avoid full re-scan every time)
- [ ] Identify hard blockers or unacceptable constraints

### Feasibility Decision Outcomes
- [ ] **GO:** API limits acceptable → proceed
- [ ] **ADAPT:** limits tight → adjust scan strategy and retry
- [ ] **STOP:** limits kill viability → reassess product direction

### CI Additions (Feasibility)
- [ ] Add smoke tests to CI:
  - [ ] App boots in CI (headless)
  - [ ] Minimal health endpoint returns OK (even stubbed)

> 🚨 **No further phases proceed without passing this gate**

---

## 2 — Phase 2: Product Decisions & Guardrails (DECISION GATE)

> **Goal:** Lock decisions that affect all later phases (without over-specifying implementation).

### Mandatory Decisions (Recorded in DECISIONS.md)
- [ ] **Processing location:** Server-side for MVP (Google Photos source)
- [ ] **Duplicate strategy (MVP):**
  - [ ] Exact duplicates (content hash)
  - [ ] Near-duplicates (perceptual hash)
- [ ] **Deletion strategy:** Export URLs only (manual deletion in Google Photos)
- [ ] **User experience:** Web UI only
- [ ] **MVP scale target:** Validate at 10k–50k photos
- [ ] **Definition of “done” for MVP:** Measurable success criteria (see Phase 9)

### Guardrails (LLM-Resistance)
- [ ] Avoid client-side SDK / mobile assumptions (Google Photos is cloud)
- [ ] Avoid premature service splitting (“microservices”) in MVP
- [ ] Prefer linear, debuggable workflows
- [ ] Prefer conservative matching over clever matching

**Exit Criteria**
- Decisions above are written down with short rationale
- Team can answer “what’s in scope / out of scope” in one minute

---

## 3 — Phase 3: Google Photos Integration & Ingestion (MVP Backbone)

> **Goal:** Reliably ingest and index a user’s Google Photos library.

### Authentication & Identity
- [ ] Google sign-in (OAuth)
- [ ] Secure token storage
- [ ] Token refresh handling
- [ ] Re-auth flow when tokens are revoked/expired

### Ingestion Pipeline
- [ ] Fetch media items (paginated)
- [ ] Store canonical photo reference:
  - [ ] Google Media Item ID
  - [ ] Product URL (for user deletion)
  - [ ] Metadata (timestamps, filename if available, dimensions if available)
- [ ] Incremental sync (avoid re-processing)
- [ ] Rate-limit handling & retries
- [ ] Failure isolation (partial progress survives; job can resume)

**Exit Criteria**
- Can ingest 50k photos without failure
- Re-scan only processes new/changed items (no full work repeat)
- No duplicate records created on retry

---

## 4 — Phase 4: Data Model & Index Foundations

> **Goal:** Define how photos, scans, and results are represented (cloud-first, not filesystem-first).

### Core Entities (Conceptual)
- [ ] **MediaAsset** (cloud-based, no local file paths)
- [ ] **ScanJob** (status, progress, timestamps, errors)
- [ ] **DuplicateGroup** (exact / near, representative, members, confidence)

### Indexing Rules
- [ ] Idempotent ingestion
- [ ] Stable internal IDs
- [ ] Hashes stored once, reused across scans
- [ ] Track processing version (so detection changes can be re-run cleanly)

**Exit Criteria**
- Schema supports all queries needed by the UI
- Re-scans do not duplicate or corrupt prior results

---

## 5 — Phase 5: Exact Duplicate Detection (Trust Baseline)

> **Goal:** 100% precision for identical photos.

- [ ] Compute content hash (server-side)
- [ ] Group identical hashes into clusters
- [ ] Choose default “keep” candidate (simple heuristic)
- [ ] Confidence = 1.0

**Exit Criteria**
- Zero false positives on test sets
- Performs acceptably for 10k+ photos

---

## 6 — Phase 6: Near-Duplicate Detection (Conservative)

> **Goal:** Catch obvious variants without breaking trust.

- [ ] Perceptual hash generation (server-side)
- [ ] Conservative similarity threshold
- [ ] Explicit confidence scoring
- [ ] Store “why matched” explanation inputs (distance/score)

### Principle
> **False negatives are acceptable. False positives are not.**

**Exit Criteria**
- <5% false positives on curated test set
- Runtime remains acceptable at 10k–50k scale

---

## 7 — Phase 7: Review Experience (Trust-First UI)

> **Goal:** Users clearly understand *why* photos are grouped and can decide what to delete.

- [ ] Grouped duplicate clusters
- [ ] Side-by-side comparison
- [ ] Confidence indicators
- [ ] Manual keep/delete selection per item
- [ ] Filters (exact vs near, confidence threshold)
- [ ] Default = no action
- [ ] Clear “what happens next” messaging (manual deletion only)

**Exit Criteria**
- Users can complete a review session without confusion
- Users can confidently explain why items were grouped

---

## 8 — Phase 8: Actionable Export (NO DELETION)

> **Goal:** Enable safe, manual cleanup by the user.

- [ ] Export CSV with Google Photos links
- [ ] Export JSON (future automation / portability)
- [ ] Clear step-by-step deletion instructions (Google Photos UI)
- [ ] Export includes “keep vs delete” selections and confidence

**Exit Criteria**
- Export is usable without additional tools
- Users can delete manually without ambiguity

---

## 9 — Phase 9: Testing, CI/CD Quality Gates & MVP Validation

> **Goal:** Prove correctness, performance, and trust — and decide if the project should continue.

### Test Coverage (Explicit)
- [ ] Unit tests (hashing, similarity scoring, grouping)
- [ ] Integration tests (end-to-end scan job with mocked Google Photos responses)
- [ ] Front-end tests (login flow, scan trigger, review UI, export)

### Test Data Requirements
- [ ] Include Google Photos-specific cases:
  - [ ] Different versions of “same” photo (compressed variants)
  - [ ] Same image re-uploaded
  - [ ] Burst / near-identical series
  - [ ] Screenshots vs camera photos (should not falsely match)
- [ ] Small set (100), medium set (1k), large validation (10k–50k)

### CI/CD Quality Gates (Must Pass)
- [ ] Lint + format checks required
- [ ] Unit tests required
- [ ] Integration tests required
- [ ] Front-end tests required
- [ ] Dependency vulnerability scan (fail on high severity)
- [ ] Targeted coverage threshold on core logic (avoid vanity %)

### MVP Success Criteria (Measurable)
- [ ] Scan 50k photos in <10 minutes (target; refine from Phase 1 measurements)
- [ ] Exact duplicates: 100% precision on test sets
- [ ] Near-duplicates: <5% false positives on curated set
- [ ] User reviews 100 clusters in <15 minutes
- [ ] Zero accidental deletions in testing (since app does not delete)

**Exit Criteria**
- CI is stable and blocks regressions
- MVP criteria are met (or decision is made to stop/pivot)

---

## 10 — Phase 10: MVP Release & Decision

> **Goal:** Release to a small group, learn fast, decide next steps.

- [ ] Limited user release (small cohort)
- [ ] Collect feedback (UX confusion, trust, false positives, scan time)
- [ ] Decide: continue, pivot, or stop
- [ ] If continuing: prioritise the next bottleneck revealed (often API limits or UX)

---

## Post-MVP (Explicitly Deferred)

- Client-side processing (optimisation only)
- Screen-scraping fallback (contingency if API limits are too strict)
- Automated deletion
- Mobile apps
- ML embeddings
- Infrastructure optimisation / service splitting

---

## LLM Guardrail (Do Not Drift)

If a suggestion includes:
- “Client SDK”
- “Microservices”
- “On-device ML”
- “Automatic deletion”
- “Enterprise features”

👉 **It is post-MVP by default unless it directly improves Phase 1 feasibility validation.**
