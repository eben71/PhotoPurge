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
- ✅ Branch protection enabled:
  - ✅ Required checks must pass before merge
  - ✅ No direct pushes to main

### Guardrails (Prevent Roadmap Drift)
- ✅ MVP scope explicitly written in README
- ✅ “Out of scope” list included to prevent drift
- ✅ No infrastructure provisioning in this phase
- ✅ No product logic implemented in this phase

**Exit Criteria**
- Repo can be cloned and skeleton can run/build locally
- CI is green and required for merge
- Docs exist and clearly constrain scope

---

## 1 — Phase 1: Feasibility & Risk Validation (EARLIEST GATE)

> **Goal:** Prove Google Photos is viable **before** building the product.

### Google Photos API Validation (Critical)
- ✅ OAuth flow works end-to-end
- ✅ Fetch full library (pagination, large accounts)
- ✅ Measure under realistic conditions:
  - ✅ API rate limits encountered during scan
  - ✅ Time to scan 10k / 50k photos
  - ✅ Metadata completeness (IDs, URLs, timestamps, dimensions where available)
- ✅ Validate expiring media URL behaviour (how often you need to refresh access)
- ✅ Confirm incremental scan strategy feasibility (avoid full re-scan every time)
- ✅ Identify hard blockers or unacceptable constraints

### Feasibility Decision Outcomes
- ✅ **GO:** API limits acceptable → proceed
- ✅ **ADAPT:** limits tight → adjust scan strategy and retry
- ✅ **STOP:** limits kill viability → reassess product direction

### Phase 1 Conclusion (Library API)
- **Library API whole-library enumeration: STOP / not viable**
  - Evidence: [PHASE1_REPORT.md](PHASE1_REPORT.md) and sample runs under `experiments/phase1/runs/*.json`
  - App-created-only scope returns 0 items for typical users

### CI Additions (Feasibility)
- ✅ Add smoke tests to CI:
  - ✅ App boots in CI (headless)
  - ✅ Minimal health endpoint returns OK (even stubbed)

> 🚨 **No further phases proceed without passing this gate**

---

## 1b — Phase 1b: Picker API Feasibility Spike (USER-SELECTED INGESTION)

> **Goal:** Validate Picker session flow + ability to retrieve user-selected items at meaningful scale.

### What We Must Measure
- ✅ Selection friction & practical selection size (10, 200, 1k–5k or album-based)
- ✅ Ability to list selected media items reliably
- ✅ Content access works (Picker `baseUrl` fetch with Authorization header + required URL params)
- ✅ Metadata coverage: id, createTime, filename, mimeType, dimensions; % with GPS if present
- ✅ Duplicate/near-match feasibility:
  - ✅ Exact duplicates via SHA-256 on downloaded bytes
  - ✅ Near matches via pHash/embeddings on downloaded renditions

### Red / Amber / Green Gates
- **GREEN:** user can select/retrieve ≥1k items (or album), high content fetch success, metadata gaps <5%
- **AMBER:** limited selection size or requires re-selection; URL refresh complexities; metadata gaps 5–20%
- **RED:** can’t reliably retrieve content/metadata; selection too limited; metadata gaps >20%

### Phase 1b Output
- ✅ Update [DECISIONS.md](DECISIONS.md) and [RISK_REGISTER.md](RISK_REGISTER.md) with findings
- ✅ Produce a short Phase 1b report (see `experiments/phase1b/` runs + notes)
- ✅ Clustering + static HTML report for review/calibration (developer-facing)

### Similarity Pipeline (Tiered Decision)
1) Candidate narrowing via metadata (mimeType, dimensions, createTime, filename heuristic; GPS only as negative filter when both present)
2) Near-duplicate scoring via content features (pHash/dHash and/or embeddings) → 0–100 similarity score
3) Optional exact duplicate confirmation by downloading bytes and hashing (SHA-256)
Outputs: candidate reduction ratio; cost/time per 1k images; false-positive/false-negative sampling plan.
Finalize thresholds/models in DECISIONS.md after Phase 1b.

---

## Risks / Open Questions (Feasibility)

- Shared project quota scaling (parked for later deep dive)
- No checksum/hash in API payloads → downloads required for exact duplicates
- Location metadata is inconsistent/optional → only a negative filter

---

## 2 — Phase 2: Validation MVP (LOCKED SCOPE)

> **Goal:** Deliver a validation MVP that proves trust, predictability, and cost control.
> Accuracy perfection is explicitly **not** a goal for Phase 2.

### Phase 2.0: Documentation & Guardrails
- ✅ Align all docs to Phase 2 validation MVP scope
- ✅ Record locked decisions + deferred decisions (with TODOs for Phase 3)
- ✅ Establish cost, trust, and scope guardrails

### Phase 2.1: Core Engine
- ✅ Picker API session + selected-item ingestion only
- ✅ Tiered similarity pipeline (metadata → perceptual hash → optional byte hash)
- ✅ Configurable max photos per run (cost guardrail)
- ✅ Deterministic, repeatable scan results

### Phase 2.2: Functional UX
- [ ] Single-session review flow (no background jobs)
- [ ] Grouping + review-only UI (no deletion)
- [ ] Clear match confidence labels + explanations

### Phase 2.3: Style & Trust Layer
- [ ] Trust-first copy (predictability over hype)
- [ ] Clear scope boundaries visible in UI
- [ ] Transparency on limits and known failure modes

### Phase 2.4: Validation & Stress Testing
- [ ] Validate with real user-selected sets (1k–5k)
- [ ] Stress test cost + time per run
- [ ] Capture feedback on confidence labels + review flow

### Phase 2 Guardrails (Cost, Trust, Scope)
- **Cost:** enforce per-run item caps; no library-wide scanning.
- **Trust:** review-only output; no automated deletion.
- **Scope:** single-session only; no background sync, no accounts history.

### Out of Scope for Phase 2
- Library-wide scanning (Library API enumeration)
- Automatic deletion or bulk destructive actions
- Embeddings/semantic similarity in the MVP
- Multi-session accounts, background sync, or persistent indexing
- Pricing plans, billing systems, or free-tier enforcement
- Hosted production deployment guarantees

**Exit Criteria**
- Phase 2 scope is clearly documented and enforced
- Trust and predictability validated with real users
- Cost guardrails respected in realistic runs

---

## 3 — Phase 3: Google Photos Integration & Ingestion (POST-VALIDATION)

> **Goal:** Expand beyond validation MVP if Phase 2 signals are positive.

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
