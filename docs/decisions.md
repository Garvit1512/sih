# Architectural Decisions — Stage B / Stage E / Orchestration

This document exists because several source files referenced a phantom **"architecture
audit plan"** by section number, and this file (`docs/decisions.md`) itself was
referenced in two more places — neither ever existed in the repository. Every decision
below is already implemented in code; this file documents *why*, so a reader doesn't
have to reconstruct the reasoning from comments alone. Numbered so code comments can
cite a specific item (`docs/decisions.md #N`) rather than a vague pointer.

Nothing here is a new decision made while writing this document. Each entry traces to
an existing code comment, test, or fixture.

---

### 1. Stage B is deterministic and rule-based, not ML

`triage_service.py` implements source-type triage as a fixed decision order (platform →
pipeline → vessel → insufficient-evidence) over geodesic distance thresholds, with no
learned model involved. This is a direct requirement, not a simplification of
convenience: `CLAUDE.md` §16 states explicitly that Stage B "should be deterministic and
explainable" and must not introduce a black-box classifier, because its entire purpose
is to produce a source hypothesis a human can audit by reading the evidence — "estimated
origin is 1.8 km from platform P-17" is a sentence a person can verify; a classifier's
confidence score is not.

### 2. Why `insufficient-evidence` still routes to Stage D

The naive design would skip vessel attribution whenever the evidence is ambiguous. The
system does the opposite: `TriageRouting.run_vessel_attribution` is `true` for both
`likely-vessel` **and** `insufficient-evidence`. The reasoning is that withholding every
lead when evidence is merely inconclusive is unhelpful to an investigator who still
needs somewhere to start looking — the alternative (silence) is worse than a clearly
qualified, low-confidence lead list. `possible-natural-seep`, `likely-platform`, and
`likely-pipeline` are the hypotheses that *do* skip Stage D, because those identify a
plausible non-vessel source; `insufficient-evidence` means no source could be
identified at all, which is a different situation.

### 3. Why that attribution is marked low-confidence

Running Stage D on ambiguous evidence would be misleading if the result looked identical
to a confident vessel finding. `AttributionResult.low_confidence` (an additive field
beyond the base contract, per `schemas/attribution.py`) is threaded through from
`TriageRouting.low_confidence` at every call site, so a candidate list produced under
`insufficient-evidence` is structurally distinguishable from one produced under
`likely-vessel` — not just in prose, but in a field a consumer can branch on.

### 4. Why in-memory state is an accepted MVP tradeoff

`investigation_repository.py` stores investigations in a plain Python dict, cleared on
every backend restart. This is accepted because the mock providers behind Stages A/C/D
are fully deterministic (`CLAUDE.md` §28) — re-running `POST /api/investigation/run`
after a restart reproduces byte-identical results, so nothing is actually lost by not
persisting. A database is explicitly out of scope for MVP (`CLAUDE.md` §42) unless a
real need is demonstrated; none has been yet.

### 5. Why `data/` lives at the repository root

`core/paths.py` resolves `data/` as a sibling of `backend/`, not nested inside it. The
directory holds both the curated case fixtures the backend loads and the `README.md`
that documents their provenance for human readers — keeping it at the root means the
same files serve both purposes without the backend's package structure implying they're
backend-private implementation detail.

### 6. Platform radius — 5.0 km, MVP placeholder

`TRIAGE_PLATFORM_RADIUS_KM=5.0` (`config.py`, `.env.example`). Chosen to make the
existing `OS-002` fixture (platform ~1.7 km from its drift origin) fire correctly with
comfortable margin — it is **not** derived from any real-world validation of what
proximity should trigger a platform hypothesis.

### 7. Pipeline radius — 2.0 km, MVP placeholder

`TRIAGE_PIPELINE_RADIUS_KM=2.0`, same status and same origin as #6 — sized against the
`OS-003` fixture (pipeline ~1.5 km from its drift origin).

### 8. Both thresholds require team sign-off before being presented as validated

Neither radius should be described anywhere (demo narration, report language, a judge
Q&A) as scientifically validated. They are configurable via `Settings`/`.env`
specifically so they can be revisited once real infrastructure data and/or a real
origin-uncertainty figure (see #10.B) are available to calibrate against. Until then,
they are demo-tuning values, stated as such.

### 9. OS-001's historical coordinates are provisional

`OS-001` is the case flagged `is_historical_ground_truth=True` and is meant to be the
real, documented historical spill `CLAUDE.md` §59 requires (known location, known
timing, sourced from ITOPF or NOAA ERMA). Its current coordinates are a
placeholder — `demo_cases.py` names it `"[PROVISIONAL] Historical Vessel-Source Case"`
and `data/README.md` states this outright. It must be replaced with a real sourced
incident before any claim of historical ground truth is made in a demo or report. Not
addressed in this pass — sourcing a real incident is separate work.

### 10. Deferred cross-stage issues

Surfaced during the Stage B/E completion pass; both are documented here rather than
fixed, because fixing either means changing a contract outside this pass's scope
(`docs/contracts.md` §10 has the full detail on both).

**A. `CaseSummary.investigation_timestamp` / `detection_timestamp` are `str`.**
Every other timestamp in the system is enforced UTC via `require_utc()`
(`schemas/common.py`); these two bypass that enforcement entirely. This is Stage E's own
schema, so it would be tempting to fix in a Stage E pass — but it's a contract change
with frontend impact once a frontend exists to consume `InvestigationReport`, so per
`CLAUDE.md` §8 it needs explicit sign-off and coordinated update (schema, tests,
eventual frontend types) rather than a silent fix. `docs/contracts.md` §10 item 4.

**B. `HindcastResult` has no origin spatial-tolerance field.** Stage B's platform and
pipeline radii (#6-#8) are compared against a bare origin point, with nothing to
calibrate the radius against the origin estimate's own uncertainty. This limits how
rigorously Stage 22's proximity check (`docs/staged-build-reference.md`) can be
justified — the radius is currently sized against fixture data, not against a real
tolerance, because no tolerance is available. Fixing it means adding a field to
`DriftResult`, which is Stage C's contract, not Stage B's or Stage E's — out of scope
here. `docs/contracts.md` §10 item 5.
