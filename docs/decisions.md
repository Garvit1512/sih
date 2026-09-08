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

**B. `HindcastResult` has no origin spatial-tolerance field.** *(Partially resolved —
see #11.)* Stage B's platform and pipeline radii (#6-#8) are compared against a bare
origin point, with nothing to calibrate the radius against the origin estimate's own
uncertainty. This limits how rigorously Stage 22's proximity check
(`docs/staged-build-reference.md`) can be justified — the radius is currently sized
against fixture data, not against a real tolerance, because no tolerance is available.
Fixing it means adding a field to `DriftResult`, which is Stage C's contract, not Stage
B's or Stage E's — out of scope here. `docs/contracts.md` §10 item 5.

### 11. `HindcastResult.origin_tolerance_km` added as an optional field

Added per `docs/stage-c-d-integration-plan.md` §4.1, in the format `CLAUDE.md` §72
requires for a contract change: the problem was #10B above (no way to calibrate Stage
B's radii, or a future Stage D candidate filter, against the hindcast's own
uncertainty); the fix is one additive, nullable field,
`HindcastResult.origin_tolerance_km: float | None = None`.

This is deliberately a partial fix, not a full close of #10B. Adding the field is
additive and breaks nothing (`docs/contracts.md` §11 rule 4 — no existing fixture or
consumer changes behavior, since every mock fixture leaves it unset and it defaults to
`null`). What is *not* done here, on purpose: no mock fixture was given a real value,
and `triage_service.py` was not changed to consume it. Both are separate, deliberate
changes — populating fixtures with a made-up tolerance would misrepresent mock data as
carrying real uncertainty information it doesn't have, and changing triage's radius
logic is a behavior change that needs its own review independent of the schema
addition. #10B stays open until both of those happen (though item 12 below does now
populate this field for real — see there).

### 12. Real Stage C/D engines: idealized synthetic forcing, synthetic AIS scoring

Per explicit instruction to implement `docs/stage-c-d-integration-plan.md`'s Stage C/D
scope (not just the integration scaffolding around it), both `RealDriftProvider` and
`RealAttributionProvider` now contain genuine working algorithms rather than
`NotImplementedError` stubs. Neither is a full production implementation, and each
says so honestly:

- **Stage C** (`app/integrations/real/drift_physics.py`, `real_drift.py`) is a real
  Lagrangian particle-advection engine — the same category of technique OpenDrift uses
  — but it runs on an idealized, deterministically-seeded synthetic current field, not
  real NOAA/Copernicus data (`docs/stage-c-d-integration-plan.md` §3 item 1: that data
  doesn't exist anywhere in this repo, and fabricating drift accuracy against invented
  forcing would violate CLAUDE.md §60/§71). Every result's `uncertainty` field carries
  this disclosure verbatim. `HindcastResult.origin_tolerance_km` (#11) is now actually
  populated by this engine, growing with hindcast duration.
- **Stage D** (`app/integrations/real/ais_generator.py`, `attribution_scoring.py`,
  `real_attribution.py`) is a real proximity + trajectory-alignment scorer over a
  deterministically-generated synthetic AIS scenario (staged-build Stages 27-31) — not
  a lookup of a hand-authored fixture. This is not a shortcut: CLAUDE.md §21 already
  mandates synthetic AIS for this project's demo, so a real algorithm operating on
  synthetic tracks is the intended design, not a workaround.

**Two new placeholder thresholds, same status as #6-#8**:
`ATTRIBUTION_HIGH_CONFIDENCE_THRESHOLD=70.0` and
`ATTRIBUTION_MEDIUM_CONFIDENCE_THRESHOLD=40.0` directly determine a vessel's
High/Medium/Low investigative label (CLAUDE.md §22) and are not yet team-approved.
Every other new setting (hindcast/forecast hours, step size, search radius, background
vessel count, feature weights) is an engineering/demo-generation parameter, not a
legally-sensitive judgment call, and is documented in `.env.example` and
`docs/stage-c-d-integration-plan.md` instead of getting its own entry here.

**The `DriftProvider`/`AttributionProvider` Protocols were widened**, not narrowed:
`get_result()` gained an optional second parameter (`detection` for Stage C, `drift`
for Stage D) that `Mock*Provider` ignores and `Real*Provider` requires — a real engine
cannot seed particles or filter candidates from `case_id` alone. This is a backend
integration interface, not one of the frozen cross-stage payload schemas
`docs/contracts.md` covers, so it did not need the `CLAUDE.md` §72 sign-off process;
`investigation_service.py` was updated to pass both through.

**Still not done, and still blocked on the same things**
`docs/stage-c-d-integration-plan.md` already named: real forcing data, a real
ground-truth anchor to score hindcast accuracy against, and any team decision to prefer
a real OpenDrift/OpenOil + real AIS feed over this disclosed synthetic middle ground.
`STAGE_C_MODE`/`STAGE_D_MODE` remain `mock` by default; nothing about the default demo
path changed.

### 13. Synthetic Stage C/D datasets are persisted files, not inline computations

Follow-up to #12, per explicit instruction: the idealized current-field parameters and
the generated AIS scenario (previously computed inline, inside the provider, on every
call) are now generated once and persisted as JSON files —
`data/synthetic_forcing/<case_id>/current_field.json` and
`data/synthetic_ais/<case_id>/scenario.json` — by
`backend/scripts/generate_synthetic_datasets.py`. `RealDriftProvider` and
`RealAttributionProvider` now read these files instead of re-deriving/re-generating on
each call.

**This changes nothing about what the data represents or claims** — it is the exact
same seeded-RNG derivation (`derive_idealized_current_parameters`) and the exact same
scenario generator (`generate_scenario`), producing byte-identical values; verified
manually (`OS-001`'s planted vessel scored 97.4/High and the surviving background
vessel scored 36.2/Low, both unchanged from before this change) and by
`test_synthetic_datasets.py`, which also regression-checks the persisted file against
the live derivation function so a future formula change without re-running the
generation script is caught rather than silently ignored.

**Why persist at all, if the values don't change:** it makes the "dataset" behind
Stage C/D an inspectable, version-controlled, `git diff`-able artifact — the same shape
a real forcing-data cache (staged-build Stage 4) or a real AIS corpus would actually
take — rather than a value that only ever exists transiently inside a function call.
`data/README.md` documents both directories, including the disclosure that neither
represents real oceanographic data or live vessel traffic.

**Not changed:** the mock fixtures (`data/cases/*/drift.json`, `attribution.json`)
remain exactly as they were, still backing `mock` mode; `STAGE_C_MODE`/`STAGE_D_MODE`
still default to `mock`.
