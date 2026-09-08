# Stage C / Stage D — Integration Plan

## 0. What this document is, and isn't

Per `CLAUDE.md` §1/§6/§24, Stage C (drift modelling) and Stage D (AIS correlation /
vessel attribution) are **not our internal algorithms to build** by default —
OpenDrift/OpenOil physics and AIS vessel scoring belong to other team members. This
document did not originally take ownership of that work; it planned the integration
boundary around it.

**Update — explicit instruction to implement Stage C/D itself.** After this plan
existed, the team explicitly instructed building real Stage C/D logic now, not just the
adapter scaffolding around it (`CLAUDE.md` §6: "unless explicitly asked" — this is that
instruction). What "real" means here was deliberately scoped down for one specific
reason: a genuine OpenDrift/OpenOil + real-AIS implementation needs real NOAA/Copernicus
current+wind data and/or a real AIS feed, neither of which exists in this repo or is
fetchable in this environment, and fabricating either would misrepresent drift accuracy
or vessel evidence (CLAUDE.md §60/§71 — never invent scientific measurements or AIS
evidence). The team chose, and this plan now reflects:

- **Stage C**: a real Lagrangian particle-advection engine, run on an idealized,
  deterministically-seeded **synthetic** current field — not real oceanographic data —
  with that disclosed on every result. Section 7 covers this.
- **Stage D**: a real proximity + trajectory-alignment scorer over a deterministically
  generated **synthetic** AIS scenario — which is not a shortcut, since CLAUDE.md §21
  already mandates synthetic AIS for this project's demo. Section 8 covers this.

Everything under "target algorithmic scope" (§2) is still a restatement of
`docs/staged-build-reference.md` Stages 13–21 (Stage C) and 26–37 (Stage D) for planning
visibility against the *full, real* (non-synthetic-forcing) version of these stages —
that fuller version remains teammates' work / future work, and §2's table still marks
it that way. What changed is that a smaller, honestly-scoped slice of it — the MVP
hindcast/forecast/scoring shape, run on synthetic inputs — is now implemented, not
mocked, in this repo. Sections 1 and 3 are updated accordingly; sections 4 through 6
are left as originally written (the integration-scaffolding plan, all still true)
except where a status line notes it's now superseded by real code.

---

## 1. Current state, verified against the code (not assumed)

| Piece | Status | Evidence |
| --- | --- | --- |
| `DriftProvider` / `AttributionProvider` Protocols | done, stable | `backend/app/integrations/base.py` |
| `MockDriftProvider` / `MockAttributionProvider` | done | `backend/app/integrations/mock/mock_drift.py`, `mock_attribution.py` — both just load a pre-authored fixture JSON per case and validate it against the schema |
| `RealDriftProvider` / `RealAttributionProvider` | **real, working, synthetic-forcing engines** | `backend/app/integrations/real/` — see §6/§7. Not a stub anymore; produces real output when given `detection`/`drift`, disclosed as running on synthetic inputs |
| Persisted synthetic datasets | **done** | `data/synthetic_forcing/<case_id>/current_field.json`, `data/synthetic_ais/<case_id>/scenario.json` — generated once by `backend/scripts/generate_synthetic_datasets.py`, read (not regenerated) by the real providers; see §6/§7 and `docs/decisions.md` #13 |
| `DriftResult` / `AttributionResult` schemas | frozen | `backend/app/schemas/drift.py`, `attribution.py`; documented in `docs/contracts.md` §3/§5 |
| Config switch | done, no changes needed | `STAGE_C_MODE` / `STAGE_D_MODE` in `Settings` (`backend/app/core/config.py`), default `"mock"` |
| Orchestrator wiring | done | `investigation_service.run_investigation()` already calls `get_drift_provider()` / `get_attribution_provider()` through the Protocol, with zero knowledge of mock vs. real |
| Upstream validation error path | **done** | `UpstreamContractError` is now raised by all three mock providers via the shared `app/integrations/validation.py` helper — see §5.2 |
| `UpstreamUnavailableError` | defined, not yet raised anywhere | `backend/app/core/errors.py` — ready for a real provider's timeout/connection-failure path; no real provider exists yet to trigger it |
| `HindcastResult.origin_tolerance_km` | **done (additive)** | `backend/app/schemas/drift.py`; see §4.1 and `docs/decisions.md` #11 |
| Synthetic AIS scenario generator (staged-build Stage 27) | **done, MVP scope** | `backend/app/integrations/real/ais_generator.py` — deterministic per `case_id`, planted + background vessels; see §7. The four cases' `attribution.json` fixtures still exist too, unchanged, for `mock` mode |
| Forcing-data acquisition & caching (staged-build Stage 4) | **still not started; deliberately not worked around with real data** | no real ocean-current/wind data exists in this repo or was fetched — `RealDriftProvider` uses an idealized *synthetic* current field instead (§6), which is a disclosed substitute, not a resolution of this blocker. A real OpenDrift/OpenOil engine driven by real forcing data still cannot be built without this |
| `DriftProvider`/`AttributionProvider` Protocol signatures | **widened** | `get_result()` gained an optional `detection`/`drift` parameter each — `Mock*Provider` ignores it, `Real*Provider` requires it. `docs/decisions.md` #12 |
| Static geospatial reference layer (staged-build Stage 5) | partially done | `backend/app/data/infrastructure.py` — hand-verified platform/pipeline list exists and is what Stage B currently checks against; no seep-zone data (STRETCH, not needed for MVP) |
| Ground-truth anchor (staged-build Stage 2) | **provisional, not real** | `OS-001`'s coordinates are a placeholder per `docs/decisions.md` #9 — a real Stage C cannot be accuracy-scored (staged-build Stage 21) until this is replaced with a sourced ITOPF/NOAA ERMA incident |

---

## 2. Target algorithmic scope (teammates' work, for planning visibility only)

Restated from `docs/staged-build-reference.md`, tier-tagged, mapped to what our mock
already stands in for. **We do not build the "target" column.** It exists so that when a
teammate's output arrives, we know which contract fields it's expected to populate.

### Stage C — Drift Modelling

| Staged-build stage | Tier | Feeds which contract field | Mock stands in? |
| --- | --- | --- | --- |
| 13 — Drift Engine Integration (OpenDrift/OpenOil) | MVP | n/a (infra) | n/a |
| 14 — Backward Hindcast & Origin Estimate | MVP | `DriftResult.hindcast` | yes, fixture |
| 15 — Forward Forecast & Predicted Spread | MVP | `DriftResult.forecast.path` | yes, fixture |
| 16 — Landfall / Sensitive-Zone Timing | MVP | `ForecastResult.time_to_coastline_hours`, `time_to_sensitive_zone_hours` | yes, fixture |
| 17 — Weathering-Enabled Forecast | WORTH ADDING | same fields, better values | n/a |
| 18 — Perturbed Ensemble Execution | WORTH ADDING | `DriftResult.uncertainty` | **no — field is untyped, see §4.1** |
| 19 — Origin Probability Field / Cone | WORTH ADDING | `DriftResult.uncertainty` | **no — same gap** |
| 20 — Hand-Rolled Advection Cross-Check | STRETCH | n/a (internal QA) | n/a |
| 21 — Drift Accuracy Eval vs. Ground-Truth Anchor | MVP, required | n/a (evaluation output) | blocked on Stage 2's real anchor, see §3 |

### Stage D — AIS Correlation & Vessel Attribution

| Staged-build stage | Tier | Feeds which contract field | Mock stands in? |
| --- | --- | --- | --- |
| 26 — AIS Schema Study & Canonical Track Representation | MVP | n/a (internal, pre-contract) | n/a |
| 27 — Synthetic AIS Scenario Generator | MVP | source of `AttributionResult` fixtures | **partially — ours are hand-authored, not generated** |
| 28 — Space-Time Candidate Filtering | MVP | which vessels appear in `candidates` at all | n/a (internal to provider) |
| 29 — Proximity Feature Score | MVP | `VesselFeatures.proximity` | yes, fixture |
| 30 — Trajectory Alignment Feature Score | MVP | `VesselFeatures.trajectory_alignment` | yes, fixture |
| 31 — Baseline Weighted Scorer & Ranked List | MVP | `VesselCandidate.score`, `confidence_tier`, ranking order | yes, fixture |
| 32 — Track Integrity Layer | WORTH ADDING | new field, **doesn't exist in `VesselFeatures` yet** | no |
| 33 — Dark-Gap Feature | WORTH ADDING | new field, **doesn't exist yet** | no |
| 34 — Behavioral Fingerprinting | WORTH ADDING | new field, **doesn't exist yet** | no |
| 35 — Historical Base-Rate Prior | STRETCH | new field, **doesn't exist yet** | no |
| 36 — Extended Scorer & Confidence Tiers | WORTH ADDING | would consume all of the above once they exist | n/a |
| 37 — Attribution Evaluation Harness | untagged | n/a (evaluation output) | n/a |

---

## 3. Dependencies that are NOT done yet — read this before scheduling real Stage C/D work

These are blockers in the literal sense: real Stage C or D integration cannot be
meaningfully tested end-to-end until they're resolved, regardless of how good the
physics/scoring code itself is.

1. **No forcing data exists.** Staged-build Stage 4 (ocean current + wind acquisition and
   caching) has not been started anywhere in this repo or, as far as this codebase shows,
   anywhere else. A real `DriftProvider` backed by OpenDrift/OpenOil has nothing to run
   against without it. This is the single hardest blocker on real Stage C — it is
   external-data access, not code, and per the staged-build doc's own risk framing it
   should be started *before* it's needed, not discovered at integration time.
   *(Still true. §6's `RealDriftProvider` sidesteps this by running on an idealized
   synthetic current field instead of real forcing data — that's a disclosed substitute
   for a demo, not a fix for this blocker. A genuine OpenDrift/OpenOil-backed engine
   still cannot be built until real forcing data exists.)*
2. **The ground-truth anchor is provisional.** `OS-001` is flagged
   `is_historical_ground_truth=True` but its coordinates are a placeholder
   (`docs/decisions.md` #9). Staged-build Stage 21 (drift accuracy evaluation — tagged
   `[MVP, required]`, "must appear in the evaluation slide regardless of what else gets
   built") cannot produce an honest number until a real ITOPF/NOAA ERMA incident replaces
   it. Sourcing that incident is separate work, not blocked on us, but it blocks Stage 21
   regardless of who does it.
3. ~~**The synthetic AIS generator (Stage 27) isn't a generator.**~~ **Done — see §7.**
   `backend/app/integrations/real/ais_generator.py` now generates deterministic
   scenarios (planted + background vessels) seeded by `case_id`, rather than only
   having four hand-authored fixtures. The fixtures still exist unchanged for `mock`
   mode (`CLAUDE.md` §28's determinism requirement applies to both equally — the
   generator is seeded, not re-randomized per call).
4. **`HindcastResult` had no spatial-tolerance field** — *(field added, see §4.1;
   consuming it is still open)*. Two different things downstream still need it consumed,
   not just present:
   - Stage B's platform/pipeline radii (`TRIAGE_PLATFORM_RADIUS_KM=5.0`,
     `TRIAGE_PIPELINE_RADIUS_KM=2.0`) are still sized against fixture data, not against
     the origin estimate's own uncertainty — `triage_service.py` was deliberately not
     changed (`docs/decisions.md` #11) — until a real Stage C reports a real value,
     wiring triage to consume a field every fixture currently leaves `null` would
     change nothing.
   - Staged-build Stage 28 (space-time candidate filtering) needs an origin *window*,
     not a bare point, to filter AIS tracks against.
5. **`DriftResult.uncertainty` is untyped** (`dict | None`), so there is currently no
   agreed shape for Stage C to hand over an ensemble/probability-cone result even once
   Stages 18–19 are built. This only blocks the WORTH ADDING ensemble tier, not MVP
   hindcast/forecast — flagged here so it isn't rediscovered at that point.

None of items 1–3 are things this document proposes fixing — they belong to whoever
builds the real Stage C/D internals. Items 4–5 are contract changes, which per
`CLAUDE.md` §8/§72 need explicit team sign-off before being made; proposals are below.

---

## 4. Contract changes that would need sign-off (not made here)

Per `CLAUDE.md` §72, a frozen-contract change is reported, not silently made. Two are
already flagged as open items in `docs/contracts.md` §10 (items 1 and 5); restated here
in the required format because they specifically block Stage C/D integration work.

### 4.1 `HindcastResult` origin has no spatial tolerance — IMPLEMENTED (additive half only)

- **PROBLEM.** Stage B's proximity radii and (eventually) Stage D's space-time candidate
  filtering both need to test against an origin *uncertainty region*, not a bare point.
  Today there is nothing to calibrate a radius against.
- **CURRENT CONTRACT.** `HindcastResult { origin: Coordinate, origin_time_window:
  TimeWindow, path: GeoJSONLineString }` — no radius, no uncertainty.
- **WHY IT IS INSUFFICIENT.** A fixed-km radius chosen against fixture data (5.0 km / 2.0
  km, both marked "not yet team-approved" in `config.py`) cannot be defended as
  calibrated to anything real once a real hindcast produces origin estimates with
  materially different uncertainty per case.
- **PROPOSED CHANGE.** Add an optional field, e.g. `origin_tolerance_km: float | None`,
  to `HindcastResult`. Optional and additive — does not break existing mock fixtures or
  consumers (`docs/contracts.md` §11 rule 4).
- **AFFECTED STAGES.** Stage C (must populate it once real), Stage B
  (`triage_service.py` could use it to justify or scale its radius check), Stage D
  (candidate filtering, once built), Stage E / frontend (display, optional).
- **MIGRATION PLAN.** Add the field as optional-nullable; update `docs/contracts.md` §3
  and §10; add it to mock fixtures only if/when Stage B is changed to consume it — until
  then mocks may leave it `null` with no behavior change.
- **STATUS.** The additive schema field is done:
  `backend/app/schemas/drift.py`'s `HindcastResult.origin_tolerance_km: float | None =
  None`, documented in `docs/contracts.md` §3/§10 and `docs/decisions.md` #11, tested in
  `backend/tests/test_contracts.py`. Deliberately **not** done: no mock fixture sets a
  value, and `triage_service.py` does not consume it — both stay open until a real Stage
  C provider exists to give the field a real value to consume.

### 4.2 `DriftResult.uncertainty` stays untyped until Stage 18/19 exist

- **PROBLEM.** No agreed shape exists for an ensemble probability field / cone.
- **CURRENT CONTRACT.** `uncertainty: dict | None`, no internal schema.
- **WHY IT IS INSUFFICIENT.** Only becomes insufficient once Stage 18 (perturbed
  ensemble) and Stage 19 (probability field/cone aggregation) are actually built — both
  are WORTH ADDING, not MVP.
- **PROPOSED CHANGE.** None yet — recommend leaving untyped until a teammate is actually
  building Stage 18/19, then defining `UncertaintyField` as its own Pydantic model against
  their real output shape rather than guessing one now.
- **AFFECTED STAGES.** Stage C, frontend map rendering (Stage 49/52 in the staged-build
  doc), Stage E.
- **MIGRATION PLAN.** Deferred — no action until triggered by real Stage 18/19 work.

---

## 5. Backend integration plan — what we actually build

This is the part of Stage C/D integration that belongs to this repo regardless of when
or how the real physics/scoring code arrives. All of it follows the existing adapter
pattern already proven by the mocks — nothing here requires touching Stage B, Stage E,
the orchestrator, or (eventually) the frontend.

### 5.1 `RealDriftProvider` / `RealAttributionProvider` shape — DONE, real bodies

Both classes now contain real logic (`backend/app/integrations/real/real_drift.py`,
`real_attribution.py` — see §6/§7 for the algorithms), and `stage_c.py`/`stage_d.py`
return an instance of it for `real` mode instead of raising anything themselves — the
factory always returns something conforming to `DriftProvider`/`AttributionProvider`.
Verified: the four demo cases still run identically under `mock` mode after this change
(`test_real_provider_shells.py`, `test_real_investigation.py`, plus a manual full run of
all four cases).

Both call the shared `validate_stage_result` helper (§5.2) on their way out, same as
the mocks — a malformed result from either fails the same way a mock fixture typo
would.

This supersedes the "open call-mechanism question" framing this section originally had:
that question was about calling into a *teammate's* real implementation (in-process,
subprocess, or HTTP), which is still genuinely unresolved for a future *actually-real*
Stage C/D (real forcing data, real AIS feed). It does not apply to the synthetic-forcing
engines built here, which run in-process and need no external call at all — see §8 for
what's still actually open.

### 5.2 Close the validation gap that already exists — DONE

`UpstreamContractError` was defined in `core/errors.py` (`CLAUDE.md` §46: "Stage A
response failed DetectionResult schema validation" is the exact model) but nothing
raised it. This was harmless only because mock fixtures are trusted, hand-verified
JSON — it would have stopped being harmless the moment a real provider's output became
untrusted.

**Implemented:** a shared `validate_stage_result(model_cls, raw, *, stage, case_id)`
helper in `backend/app/integrations/validation.py`, wrapping `.model_validate()` in
`try/except ValidationError` and re-raising `UpstreamContractError` with a message
naming the stage and case. All three mock providers (`MockDetectionProvider`,
`MockDriftProvider`, `MockAttributionProvider`) now call it instead of
`.model_validate()` directly, so a fixture typo and a future real provider's bad output
fail identically — proven by `backend/tests/test_upstream_validation.py`. Any future
`RealDriftProvider`/`RealAttributionProvider` (§5.1) calls the same helper — nothing
stage-specific to reimplement.

### 5.3 Error handling beyond schema validation

Schema validation is the contract boundary; it isn't the only failure mode a real
provider introduces. A subprocess/HTTP-backed provider can also time out, crash, or
return nothing. None of this exists to design yet because no real provider exists, but
the plan is:

- Any failure that isn't a schema-validation failure (timeout, connection error,
  non-zero exit) should be caught and re-raised as `AppError` rather than propagating a
  raw exception to `unhandled_error_handler`'s generic 500 — so the frontend (once it
  exists) can tell "the model produced a bad shape" apart from "the model didn't
  respond." `UpstreamUnavailableError` (`status_code=503`) now exists in
  `core/errors.py` for exactly this — defined ahead of need, since no real provider
  exists yet to actually raise it.
- `api_timeout_seconds` already exists in `Settings` and should bound whatever call
  mechanism §8 settles on.

### 5.4 Testing strategy for the cutover

Mirrors `CLAUDE.md` §80 (Phase 9/10) applied specifically here:

1. **Contract round-trip test.** `test_real_drift_engine.py` / `test_real_attribution_engine.py`
   cover this for the synthetic-forcing engines built here, since their raw output is
   this repo's own code, not a teammate's. Still open for an *actually-real* future
   engine: a hand-constructed example of a teammate's real raw output, run through the
   schema before that provider is wired in — no such sample exists yet.
2. **Unit test for the validation-failure path — DONE.**
   `backend/tests/test_upstream_validation.py` asserts `validate_stage_result` (and, via
   it, all three mock providers) raises `UpstreamContractError`, not a raw
   `ValidationError`, on a deliberately malformed payload. A future
   `RealDriftProvider`/`RealAttributionProvider` gets this for free by calling the same
   helper — no new test needed unless the real adapter adds logic beyond the call in
   §5.1's snippet.
3. **Re-run the orchestrator with real providers injected — DONE, with a caveat.**
   `test_real_investigation.py` runs `run_investigation()` with `RealDriftProvider`/
   `RealAttributionProvider` injected directly and asserts the orchestrator, Stage B,
   and Stage E all still function — proving the Protocol adapter pattern works. It
   deliberately does **not** assert the same triage hypothesis mock mode produces for
   that case: the real engine's origin is seeded from the detection centroid and moved
   by an idealized current, which lands somewhere physically different from the mock
   fixture's hand-placed origin, so asserting hypothesis parity would be asserting a
   coincidence, not a property of the system.
4. **Do not flip the default.** `STAGE_A_MODE`/`STAGE_C_MODE`/`STAGE_D_MODE` stay
   `"mock"` in `.env.example` until a specific case has been run end-to-end in `real`
   mode and its output manually reviewed — consistent with `CLAUDE.md` §58's demo-first
   principle: the curated mock path remains the default, reliable demo path even after
   real providers exist.

### 5.5 Provenance — no change needed

`investigation_service.run_investigation()` already tags provenance as
`f"stage-c-{config.stage_c_mode}"` / `f"stage-d-{config.stage_d_mode}"`, so a cutover to
`real` mode is automatically reflected in every report's provenance block with zero
additional code. (`provenance` itself is untyped — `docs/contracts.md` §10 item 8 — but
that's an existing open item unrelated to this cutover.)

---

## 6. Stage C real engine: idealized-forcing drift advection

`backend/app/integrations/real/drift_physics.py` + `forcing_data.py` + `real_drift.py`.

**Update — the current-field parameters are now a persisted dataset, not an inline
computation.** Originally `idealized_current_mps()` derived `(base_speed_mps,
base_bearing_deg)` from `case_id` via a seeded RNG on every call. That's now split in
two: `derive_idealized_current_parameters()` (still the same seeded derivation) runs
once inside `backend/scripts/generate_synthetic_datasets.py` and writes
`data/synthetic_forcing/<case_id>/current_field.json`; `RealDriftProvider` reads that
file (`forcing_data.load_current_parameters()`) instead of re-deriving it. Numerically
identical output either way (same seed, same formula) — the point is making the
"dataset" behind Stage C an inspectable, version-controlled file, the way real
forcing-data caching (staged-build Stage 4) would actually work, rather than a value
that only ever exists inside a function call. `data/README.md` documents the file.

**What it is.** A real Lagrangian particle-advection simulation: given a start point,
start time, and a velocity field, step the point forward or backward in time using
`pyproj.Geod` for correct geodesic stepping (not a flat-degree approximation). This is
the same category of technique OpenDrift/OpenOil uses internally — advecting particles
through a vector field — just without OpenDrift's actual ocean-physics model behind the
field itself.

**What the velocity field is, and isn't.** `current_at()` returns a deterministic (east,
north) current vector given a case's persisted base speed/bearing (0.15–0.45 m/s, a
plausible surface-current magnitude, picked to be plausible-looking, not measured) plus
a slow sinusoidal bearing oscillation over time so the resulting path curves rather than
running dead straight. It is **not** NOAA/HYCOM/Copernicus data, and does not claim
oceanographic validity regardless of now living in a file — persisting it doesn't make
it more real, only more inspectable. Every `DriftResult` this engine produces carries
that disclosure verbatim in `uncertainty.disclosure`, copied from the persisted file's
own `disclosure` field.

**Hindcast.** Seeds from `DetectionResult.spill.centroid` at `DetectionResult.detected_at`
(this is *why* the `DriftProvider` Protocol needed widening — see §5.1/§6), steps
backward for `settings.drift_hindcast_hours` (default 6h) in `drift_step_minutes`
increments, and reports the final backward position as `hindcast.origin`.
`origin_tolerance_km` is populated (not left `null`, unlike every mock fixture) as
`hindcast_hours × drift_origin_tolerance_km_per_hour` — a simple linear
uncertainty-grows-with-simulation-duration model, not a rigorously derived error bound.
`origin_time_window` is a symmetric pad (default ±1h) around that backward time.

**Forecast.** Same engine, stepped forward for `drift_forecast_hours` (default 24h) from
the same start point/time. `time_to_coastline_hours` and `time_to_sensitive_zone_hours`
are left `null` — not because no crossing was found, but because **no coastline dataset
exists in this repo** (`data/infrastructure/` has only `platforms.geojson` and
`pipelines.geojson`). Per CLAUDE.md §70, this is disclosed in `uncertainty.landfall_timing`
rather than silently reusing the schema's "no crossing" null semantics for a different
actual reason.

**Determinism.** Same `(case_id, detection)` always produces the same result — no
wall-clock or unseeded randomness anywhere in the path. Tested in
`test_real_drift_engine.py` and, for the persisted file itself,
`test_synthetic_datasets.py` (which also guards against the file drifting out of sync
with `derive_idealized_current_parameters()` if that function's formula ever changes
without re-running the generation script).

## 7. Stage D real engine: synthetic AIS generation and scoring

`backend/app/integrations/real/ais_generator.py` + `ais_data.py` + `attribution_scoring.py`
+ `real_attribution.py`.

**What it is.** A real implementation of staged-build Stages 27–31's MVP scope:
generate a scenario once, persist it, filter the persisted candidates by space-time,
score two features, combine them transparently, rank. Not a lookup of a hand-authored
fixture, and — as of the same update described in §6 — not a scenario generated fresh
on every request either.

**Update — the scenario is now a persisted dataset, not generated per request.**
`generate_scenario()` (still the exact same logic) now runs once inside
`backend/scripts/generate_synthetic_datasets.py`, using that case's already-persisted
current-field parameters (via a real `RealDriftProvider` call, so the AIS scenario is
generated against the actual origin/bearing the drift engine produces — not
independently recomputed and potentially inconsistent with it) and writes
`data/synthetic_ais/<case_id>/scenario.json`. `RealAttributionProvider` reads that file
(`ais_data.load_scenario()`) and scores it against whichever `drift` result it's
actually called with — the *tracks* are fixed data, but the *scoring* still runs live
against the real `DriftResult` passed in, which is the part that's actually
"attribution," not "data." `data/README.md` documents the file.

**Scenario generation (`ais_generator.py`, now generation-time only).** Deterministic
per `case_id`: one "planted" vessel built on a course equal to the drift path's initial
bearing (`compute_drift_bearing`), passing within 0.5–4 km of the origin at the midpoint
of the origin time window: this is staged-build Stage 27's "guilty vessel" concept. Plus
`attribution_background_vessel_count` (default 4) background vessels on unrelated
random courses, 25–110 km from the origin at closest approach — plausible traffic that
should mostly get filtered out or score low, not vessels responsible for anything.
Genuinely synthetic, never live traffic (`CLAUDE.md` §21) — every result's
`data_disclosure` says so, and so does the persisted file's own `disclosure` field.

**Space-time filtering (`filter_candidate`).** Staged-build Stage 28: a track survives
only if it has a report inside the origin time window (padded by
`attribution_time_window_pad_hours`, default 3h) **and** within
`attribution_candidate_search_radius_km` (default 60 km) of the origin. In practice this
excludes most background vessels — a real filter, not a formality; see the worked
example in the implementation notes below.

**Scoring (`attribution_scoring.py`).** `proximity_score` is linear in distance from the
search radius (closer = higher, 0 at the radius edge). `trajectory_alignment_score` is
linear in angular difference between the candidate's course at closest approach and the
drift bearing (0° difference = 100, 180° = 0). Combined as
`attribution_proximity_weight × proximity + attribution_trajectory_weight × alignment`
(default 0.5/0.5 — an equal, transparent weighting, per PRD §8.5's explicit instruction
against implying a technique more sophisticated than what's actually implemented).
Confidence tier is a threshold band on the combined score
(`attribution_high_confidence_threshold=70`, `attribution_medium_confidence_threshold=40`
— **placeholder values, not yet team-approved**, same status as the Stage B triage radii;
see `docs/decisions.md` #12). Evidence strings are generated, not templated per fixture,
using the same phrasing style the hand-authored fixtures already used
(`"Vessel track passed within X km..."`, `"...closely/loosely/not consistent with..."`).

**Worked example (real run, `OS-001`, captured while writing this doc):** of 5 generated
tracks (1 planted + 4 background), 2 survived filtering. The planted vessel scored 97.4
(proximity 94.8, trajectory 100.0, `High`); one background vessel that happened to pass
within the search radius scored 36.2 (`Low`); the other 3 were filtered out entirely.
This is what a working filter is supposed to do — most generated tracks not appearing in
`candidates` at all is correct behavior, not a bug.

**Determinism.** Same `(case_id, drift)` always produces the same scenario and the same
scores — tested in `test_real_attribution_engine.py` and `test_synthetic_datasets.py`,
including that the planted vessel outranks background traffic (a property the algorithm
has to earn, not one asserted by constructing a fixture that already says so).

## 8. Open questions for the team (not decided here)

- **Is the synthetic-forcing engine (§6/§7) the intended permanent `real` mode, or a
  placeholder for an eventual genuinely-real one?** Right now `STAGE_C_MODE=real` /
  `STAGE_D_MODE=real` means "the disclosed synthetic-forcing engine," not "OpenDrift
  with real ocean data" or "real AIS." If the team later gets real forcing data or a
  real AIS feed, that's a *third* mode in effect, even if it reuses the literal string
  `"real"` — worth deciding now whether that becomes `STAGE_C_MODE=real` (replacing
  this engine) or a new value entirely, so `docs/contracts.md` §8.3's mode list doesn't
  quietly go stale.
- **Real forcing data / real AIS feed, if ever pursued.** Still genuinely open, and
  still not something this session can resolve: sourcing NOAA/HYCOM/Copernicus current
  and wind data (staged-build Stage 4), and/or a real AIS feed, both require external
  access this environment doesn't have and the team hasn't arranged.
- **Who sources the real ground-truth anchor** for `OS-001` (`docs/decisions.md` #9) and
  by when — this gates staged-build Stage 21 (drift accuracy *against a real incident*),
  which the synthetic-forcing engine cannot substitute for: scoring it against a
  synthetic current field would not be a real accuracy figure by construction.
- **Sign-off on the two new placeholder confidence thresholds** (`ATTRIBUTION_HIGH_CONFIDENCE_THRESHOLD`,
  `ATTRIBUTION_MEDIUM_CONFIDENCE_THRESHOLD`), same open status as the Stage B triage
  radii (`docs/decisions.md` #6-#8, #12).
- **A discovered, unrelated gap, noted for follow-up, not fixed here:**
  `run_investigation()`'s `config: Settings` parameter is accepted but never actually
  used to select providers — `get_drift_provider()`/`get_attribution_provider()` always
  read the global `app.core.config.settings` singleton, not the `config` argument. A
  caller passing `config=Settings(stage_c_mode="real")` expecting real mode would
  silently still get mock. Not touched in this pass (out of scope for "implement Stage
  C/D"); `test_real_investigation.py` sidesteps it by injecting providers directly
  instead.
