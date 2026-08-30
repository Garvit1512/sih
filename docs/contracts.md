# Cross-Stage Interface Contracts

**Status:** frozen. **Source of truth:** `backend/app/schemas/`. **Enforcement:** `backend/tests/test_contracts.py` (12 tests).

This document describes the objects that cross a boundary between two stages of the pipeline. It is written for the people who own Stages A, C and D — whose real implementations must adapt their output to these shapes — and for the frontend, which consumes them.

It is a description of what the code already enforces, not a proposal. Where this document and `backend/app/schemas/` disagree, the schemas win and this document is the defect. Section 10 lists the parts that are deliberately *not* frozen yet, so an unspecified field reads as a known gap rather than an oversight.

A note on ordering. The stages are lettered A–E in the PRD, but that is not the order data flows in. Triage (Stage B) tests the *hindcasted origin* against infrastructure, so it consumes Stage C's output — `app/api/triage.py` calls the drift provider before it can triage anything. The real order is **A → C → B → D → E**, and this document follows it. See `docs/staged-build-reference.md` §0.1 for the full dependency spine.

---

## 1. Primitives

These apply to every contract below. `app/schemas/common.py` is the only place they are defined.

### 1.1 Coordinates and axis order

The canonical CRS is **WGS84 / EPSG:4326**. There are two representations and they use **opposite axis order**:

| Representation | Order | Used by |
| --- | --- | --- |
| `Coordinate` object | `{"lat": …, "lon": …}` | every named point in an API payload |
| GeoJSON geometry | `[lon, lat]` | every `coordinates` array |

This is not an inconsistency to fix — it is the GeoJSON specification (`[longitude, latitude]`) meeting a named object where the field names make order irrelevant. `Coordinate.to_geojson_point()` is the single place the two meet, so an axis-order bug can only be introduced there, and `test_coordinate_to_geojson_uses_lon_lat_order` is the regression test.

`lat` is constrained to `[-90, 90]` and `lon` to `[-180, 180]`. Longitudes must be in the −180/180 convention, not 0–360.

**When hand-encoding, this is the single most likely place to make an error.** A transposed pair produces a schema-valid payload in the wrong hemisphere.

### 1.2 Time

Every `datetime` field must be **timezone-aware and UTC**. Naive datetimes and non-zero offsets are both rejected at the boundary by `require_utc()`:

- `"2026-08-29T06:00:00Z"` — accepted
- `"2026-08-29T06:00:00+00:00"` — accepted
- `"2026-08-29T06:00:00"` — rejected (naive)
- `"2026-08-29T06:00:00+05:30"` — rejected (non-UTC offset)

Enforced by `test_time_window_rejects_naive_datetime`, `test_time_window_rejects_non_utc_offset`, and `test_time_window_accepts_utc`.

Note the exception, which is real and currently unguarded: `CaseSummary.investigation_timestamp`, `CaseSummary.detection_timestamp` and `CaseMeta.date` are typed `str`, **not** `datetime`, so none of the above applies to them. See §10.

### 1.3 Units

Declared in the field name in every case. There are no unit-less quantities in these contracts.

| Suffix | Unit |
| --- | --- |
| `_km`, `_km2` | kilometres, square kilometres |
| `_hours` | hours |
| `elongation` | dimensionless ratio |

### 1.4 Numeric scales — read this before hand-encoding a score

Scores do **not** share one scale across contracts:

| Field | Range | Constraint enforced |
| --- | --- | --- |
| `DetectionConfidence.value` | `0`–`1` | yes (`ge=0, le=1`) |
| `VesselCandidate.score` | `0`–`100` | yes (`ge=0, le=100`) |
| `VesselFeatures.proximity`, `.trajectory_alignment` | `0`–`100` | yes (`ge=0, le=100`) |
| `TriageConfidence.value` | — | **no constraint** |

A detection confidence of `0.87` and a vessel score of `88.0` express comparable strength on different scales. This is a live inconsistency, flagged in §10; until it is resolved, encode to the ranges in this table, not to whichever scale you saw last.

### 1.5 Required, nullable, and optional are three different things

This distinction is what makes two independent hand-encodings of the same spill match or not match, so it is worth stating precisely:

- **Required** — the key must be present with a non-null value.
- **Required-nullable** (`T | None` with no default) — the key **must be present**, and may be `null`.
- **Optional** (`T | None = None`) — the key may be omitted entirely.

`InfrastructureEvidence.distance_km`, `.id` and `.name` are required-nullable: omitting them is a validation error, setting them to `null` is correct. `InfrastructureEvidence.location` is optional. Each table below marks which is which.

A `null` means *not applicable or not computed* and must never be represented as `0`, `""`, or an empty list. `ForecastResult.time_to_coastline_hours: null` means "no coastline crossing within the forecast horizon" — rendering it as `0` would read as "arrives immediately."

### 1.6 Identity

`case_id` is a string and appears on every stage result. It is the join key across all five stages, and every result for one investigation carries the same value. Current registry: `OS-001`, `OS-002`, `OS-003` (`app/data/demo_cases.py`).

Vessels are identified by `vessel_id`, a string. The fixtures use the form `MMSI-100001`; the schema does not constrain the format.

---

## 2. Stage A — `DetectionResult`

`app/schemas/detection.py`. Produced by SAR segmentation; consumed by Stage C (seeding), Stage E, and the frontend's detection step.

### `DetectionResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `detected_at` | `datetime` | required | UTC-enforced (§1.2) |
| `spill` | `SpillGeometry` | required | |
| `detection_confidence` | `DetectionConfidence` | required | |

### `SpillGeometry`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `centroid` | `Coordinate` | required | `{lat, lon}` |
| `polygon` | `GeoJSONPolygon` | required | `[lon, lat]` rings |
| `area_km2` | `float` | required | `ge=0` |
| `perimeter_km` | `float` | required | `ge=0` |
| `elongation` | `float` | required | `ge=0`, dimensionless |
| `coastline_distance_km` | `float \| None` | optional | |

The polygon is `GeoJSONPolygon` — a single `Polygon`, **not** `MultiPolygon`. Disconnected patches of oil currently have no representation in this contract; see §10.

The centroid is not guaranteed to fall inside the polygon (crescent and multi-part geometries legitimately place it outside). Nothing downstream may assume it does.

### `DetectionConfidence`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `value` | `float` | required | `ge=0, le=1` |
| `type` | `"indicative_uncalibrated"` | defaulted | literal — the only accepted value |
| `label` | `str` | defaulted | `"Indicative detection confidence"` |

`type` is a frozen literal on purpose. The value comes from raw model class probabilities, which are **not** calibrated, and the type field is what stops a consumer presenting it as a calibrated probability. Do not display this as "X% confident."

### Worked example (`data/cases/OS-001/detection.json`)

```json
{
  "case_id": "OS-001",
  "detected_at": "2026-08-29T14:00:00Z",
  "spill": {
    "centroid": {"lat": 12.5500, "lon": 70.5500},
    "polygon": {
      "type": "Polygon",
      "coordinates": [[
        [70.5400, 12.5400],
        [70.5600, 12.5400],
        [70.5600, 12.5600],
        [70.5400, 12.5600],
        [70.5400, 12.5400]
      ]]
    },
    "area_km2": 6.4,
    "perimeter_km": 13.1,
    "elongation": 2.3,
    "coastline_distance_km": 58.0
  },
  "detection_confidence": {
    "value": 0.87,
    "type": "indicative_uncalibrated",
    "label": "Indicative detection confidence"
  }
}
```

Note the ring closes (first coordinate repeated last) and every pair is `[lon, lat]` while `centroid` is `{lat, lon}`.

---

## 3. Stage C — `DriftResult`

`app/schemas/drift.py`. Produced by the drift engine (OpenDrift/OpenOil); consumed by **Stage B** (which needs `hindcast.origin`), Stage D, Stage E, and the frontend.

### `DriftResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `hindcast` | `HindcastResult` | required | backward — where it came from |
| `forecast` | `ForecastResult` | required | forward — where it is going |
| `uncertainty` | `dict \| None` | optional | **untyped** — see §10 |

### `HindcastResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `origin` | `Coordinate` | required | the estimated origin point |
| `origin_time_window` | `TimeWindow` | required | `{start, end}`, both UTC |
| `path` | `GeoJSONLineString` | required | backward drift path |

`origin` and `origin_time_window` together are what Stage B tests against infrastructure and what Stage D filters candidate vessels against. `path` is a separate requirement from `origin`: trajectory-alignment scoring needs the whole path, not just its endpoint.

### `ForecastResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `path` | `GeoJSONLineString` | required | forward drift path |
| `time_to_coastline_hours` | `float \| None` | optional | `null` = no crossing within horizon |
| `time_to_sensitive_zone_hours` | `float \| None` | optional | `null` = no crossing within horizon |

Both `null` values mean *no crossing predicted within the forecast horizon*, which is a different statement from "arrives at hour zero." See §1.5.

### Worked example (`data/cases/OS-001/drift.json`)

```json
{
  "case_id": "OS-001",
  "hindcast": {
    "origin": {"lat": 12.5000, "lon": 70.5000},
    "origin_time_window": {
      "start": "2026-08-29T06:00:00Z",
      "end": "2026-08-29T10:00:00Z"
    },
    "path": {
      "type": "LineString",
      "coordinates": [
        [70.5000, 12.5000],
        [70.5250, 12.5250],
        [70.5500, 12.5500]
      ]
    }
  },
  "forecast": {
    "path": {
      "type": "LineString",
      "coordinates": [
        [70.5500, 12.5500],
        [70.5900, 12.5900],
        [70.6300, 12.6300]
      ]
    },
    "time_to_coastline_hours": 21.5,
    "time_to_sensitive_zone_hours": null
  },
  "uncertainty": null
}
```

The hindcast path ends where the forecast path begins — both at the detection centroid `[70.5500, 12.5500]`. That continuity is a property of the fixture, not a constraint the schema enforces.

---

## 4. Stage B — `TriageResult`

`app/schemas/triage.py`, engine in `app/services/triage_service.py`. This stage is owned in-house. It consumes `DriftResult.hindcast.origin` and produces the routing decision that gates Stage D.

### `TriageHypothesis` — the frozen enum

Exactly five values, and consumers may match on nothing else:

```
likely-vessel  |  likely-platform  |  likely-pipeline  |  possible-natural-seep  |  insufficient-evidence
```

`possible-natural-seep` is in the enum but **the current engine never emits it** — seep-zone detection is STRETCH scope. The value stays frozen in the contract so that adding it later is a new evidence source feeding an existing label rather than a schema change rippling through the frontend and Stage E.

### `TriageResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `hypothesis` | `TriageHypothesis` | required | one of the five above |
| `confidence` | `TriageConfidence` | required | |
| `evidence` | `TriageEvidence` | required | |
| `routing` | `TriageRouting` | required | |

### `TriageConfidence`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `tier` | `"High" \| "Medium" \| "Low"` | required | |
| `value` | `float \| None` | optional | **unconstrained** — see §10 |
| `type` | `"rule_based"` | defaulted | literal |

`type` is frozen to `rule_based` because this confidence is a deterministic rule outcome, not a probability. No ML classifier is involved.

### `TriageEvidence` / `InfrastructureEvidence`

| Field | Type | Presence |
| --- | --- | --- |
| `platform` | `InfrastructureEvidence` | required |
| `pipeline` | `InfrastructureEvidence` | required |
| `vessel_evidence_available` | `bool` | required |
| `narrative` | `list[str]` | required |

`InfrastructureEvidence`:

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `nearby` | `bool` | required | within the configured radius |
| `distance_km` | `float \| None` | **required-nullable** | `null` = no data for this region |
| `id` | `str \| None` | **required-nullable** | |
| `name` | `str \| None` | **required-nullable** | |
| `location` | `Coordinate \| None` | optional | populated for platforms; always `null` for pipelines |

`distance_km: null` and `nearby: false` mean different things: the first is *no infrastructure data exists for this region*, the second is *data exists and nothing is within the radius*. A consumer that treats them the same will report a confident vessel hypothesis on an empty dataset.

`narrative` is human-readable evidence lines generated by `_build_narrative()`, intended for direct display.

### `TriageRouting` — the gate

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `run_vessel_attribution` | `bool` | required | |
| `low_confidence` | `bool` | defaulted `false` | |

Current engine behaviour:

| Hypothesis | `run_vessel_attribution` | `low_confidence` | `confidence.tier` |
| --- | --- | --- | --- |
| `likely-vessel` | `true` | `false` | `Medium` |
| `insufficient-evidence` | `true` | `true` | `Low` |
| `likely-platform` | `false` | `false` | `High` |
| `likely-pipeline` | `false` | `false` | `High` |
| `possible-natural-seep` | *(never emitted)* | — | — |

Verified against the three demo cases: `OS-001` → `likely-vessel` / `Medium` / attribution runs with 3 candidates; `OS-002` → `likely-platform` / `High` / attribution returns `executed: false`, `candidates: []`; `OS-003` → `likely-pipeline` / `High` / same. The non-vessel cases are the ones that demonstrate the `executed: false` distinction in §5.

Decision order in `evaluate_triage()`: platform wins if within `triage_platform_radius_km` **and** (no pipeline nearby, or the platform is at least as close); otherwise pipeline if within `triage_pipeline_radius_km`; otherwise vessel if vessel evidence is available; otherwise insufficient-evidence.

Both radii come from `Settings` (`TRIAGE_PLATFORM_RADIUS_KM` = 5.0, `TRIAGE_PIPELINE_RADIUS_KM` = 2.0). **These defaults are placeholders and are not yet team-approved** — see §10.

---

## 5. Stage D — `AttributionResult`

`app/schemas/attribution.py`. Produced by AIS vessel scoring; consumed by Stage E and the frontend. Runs only when `TriageRouting.run_vessel_attribution` is `true`.

### `AttributionResult`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `executed` | `bool` | required | whether scoring actually ran |
| `reason` | `str \| None` | optional | why it did not run |
| `data_disclosure` | `DataDisclosure \| None` | optional | required in practice when `executed` |
| `candidates` | `list[VesselCandidate]` | defaulted `[]` | ranked, highest score first |
| `low_confidence` | `bool` | defaulted `false` | carried through from triage |

`executed: false` with `candidates: []` is **not** the same as `executed: true` with `candidates: []`. The first means no vessel search was performed — the triage gate diverted it; the second means a search ran and found nothing. A consumer rendering both as "no suspects found" erases the multi-hypothesis triage behaviour at the last hop. When `executed` is `false`, `reason` should say why.

`low_confidence` is an additive field beyond the PRD §13 example. It carries the `insufficient-evidence` routing outcome through to the report and the map, so an auto-run search on ambiguous evidence stays visibly labelled.

### `VesselCandidate`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `vessel_id` | `str` | required | |
| `vessel_name` | `str \| None` | optional | |
| `score` | `float` | required | `ge=0, le=100` |
| `confidence_tier` | `"High" \| "Medium" \| "Low"` | required | |
| `features` | `VesselFeatures` | required | |
| `evidence` | `list[str]` | required | human-readable justification |

`features` travels with `score` by design — the combined score is never transmitted without its components, so the evidence breakdown is available to both the report and the map. `VesselFeatures` currently carries `proximity` and `trajectory_alignment` only, both `0`–`100`; the dark-gap, behavioural and integrity features are not in this contract yet (§10).

### `DataDisclosure`

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `ais_type` | `"synthetic" \| "real"` | required | |
| `description` | `str` | required | |

This exists so that the synthetic nature of the AIS data is carried *in the payload*, not asserted separately in a slide. It is currently always `synthetic`.

### Worked example

See `data/cases/OS-001/attribution.json` — three ranked candidates, scores 88.0 / 61.0 / 34.0, each with its two feature scores and evidence lines.

---

## 6. Stage E — `InvestigationReport`

`app/schemas/report.py`. **Reporting layer only** — every field is filled from an already-computed stage result. Stage E infers nothing and computes nothing new; if a value is needed and does not exist upstream, that is a gap in an earlier stage, not a licence to derive it here.

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `summary` | `CaseSummary` | required | |
| `detection` | `DetectionResult` | required | embedded whole |
| `source_hypothesis` | `TriageResult` | required | embedded whole |
| `drift` | `DriftResult` | required | embedded whole |
| `attribution` | `AttributionResult` | required | embedded whole |
| `provenance` | `dict[str, str]` | required | **untyped** — see §10 |
| `limitations` | `list[str]` | defaulted | `KNOWN_LIMITATIONS`, 7 entries |
| `synthetic_ais_disclosure` | `str \| None` | optional | `SYNTHETIC_AIS_DISCLOSURE` when applicable |
| `disclaimer` | frozen literal | defaulted | see below |

### The disclaimer is a typed literal

```python
DISCLAIMER: Literal["this is a decision-support lead list, not a legal determination."]
```

It is typed as the exact required string so it **cannot be silently reworded**. Any other value fails validation. This is the mechanism that guarantees the positioning statement appears verbatim in every generated report.

`KNOWN_LIMITATIONS` ships seven entries covering synthetic AIS, uncalibrated Stage A confidence, incomplete infrastructure coverage, proximity/trajectory-only MVP attribution, AIS dark gaps, n=1 drift validation, and the lead-not-conclusion framing. They default onto every report.

`CaseSummary` carries `case_id`, `name`, `region`, `investigation_timestamp`, `detection_timestamp` — the last two as `str`, not `datetime`, so §1.2 does not apply to them (§10).

---

## 7. `InvestigationCase` — the aggregate the frontend consumes

`app/schemas/investigation.py`. One object holding the whole investigation state.

| Field | Type | Presence | Notes |
| --- | --- | --- | --- |
| `case_id` | `str` | required | |
| `case_meta` | `CaseMeta` | required | |
| `detection` | `DetectionResult \| None` | optional | `null` until computed |
| `triage` | `TriageResult \| None` | optional | |
| `drift` | `DriftResult \| None` | optional | |
| `attribution` | `AttributionResult \| None` | optional | |
| `report` | `InvestigationReport \| None` | optional | |
| `provenance` | `dict[str, str]` | defaulted `{}` | |
| `status` | `"pending" \| "running" \| "complete" \| "failed"` | defaulted `"pending"` | |
| `error` | `str \| None` | optional | |

Every stage result is explicitly nullable rather than defaulted to a sentinel, so the frontend can distinguish *not yet computed* and *not applicable* from *zero*. This is the same distinction as §1.5 and it is the reason the wizard can show "not checked" rather than an empty panel that reads as "nothing found."

`CaseMeta`: `case_id`, `name`, `region`, `date` (`str`), `is_historical_ground_truth` (`bool`). `OS-001` is currently flagged `is_historical_ground_truth: true` but is named `[PROVISIONAL] Historical Vessel-Source Case` — the real ITOPF/NOAA ERMA case has not been selected yet (§10).

---

## 8. HTTP surface

### 8.1 Endpoints

All under `/api`. Every stage endpoint takes `{"case_id": "…"}` as its request body.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{"status": "ok"}` |
| `GET` | `/api/cases` | — | `{"cases": [CaseMeta, …]}` |
| `GET` | `/api/cases/{case_id}` | — | `CaseMeta` |
| `POST` | `/api/detect` | `{case_id}` | `DetectionResult` |
| `POST` | `/api/drift` | `{case_id}` | `DriftResult` |
| `POST` | `/api/triage` | `{case_id}` | `TriageResult` |
| `POST` | `/api/attribute` | `{case_id}` | `AttributionResult` |
| `POST` | `/api/report/{case_id}` | — | `InvestigationReport` |
| `POST` | `/api/investigation/run` | `{case_id}` | `InvestigationCase` |
| `GET` | `/api/investigation/{case_id}` | — | `InvestigationCase` |

Two call-ordering details that are easy to trip over:

- `/api/report/{case_id}` takes the id in the path and has **no body**, unlike the other stage endpoints.
- `/api/report/{case_id}` is **not** standalone. It reads a completed investigation, so calling it before `POST /api/investigation/run` returns `404 investigation_not_found` with the message *"No completed investigation exists for case 'X'. Call POST /api/investigation/run first."* The individual stage endpoints (`/detect`, `/drift`, `/triage`, `/attribute`) have no such precondition and can be called directly in any order.

Responses are the contract objects themselves. There is no separate API-layer model that reshapes them — a second definition of the same object is exactly the drift this document exists to prevent.

### 8.2 Error envelope

Every error response, without exception:

```json
{
  "error": {
    "type": "case_not_found",
    "message": "…",
    "request_id": "…"
  }
}
```

Never a raw stack trace. `request_id` is a fresh UUID per response.

| `type` | Status | Raised when |
| --- | --- | --- |
| `case_not_found` | 404 | unknown `case_id` |
| `investigation_not_found` | 404 | no investigation for that case |
| `upstream_contract_error` | 502 | a Stage A/C/D response failed schema validation |
| `internal_error` | 500 | anything unhandled |

`upstream_contract_error` is the one to know about: it means an upstream stage returned something that does not conform to the contract in this document. It is a 502 rather than a 500 because the fault is upstream, not here.

### 8.3 Stage provider modes

`STAGE_A_MODE`, `STAGE_C_MODE`, `STAGE_D_MODE` each accept `mock` or `real` and default to `mock`. In `mock` mode the stage result is read from `data/cases/{case_id}/*.json`. Swapping a stage to `real` must not require any change to the schemas here — that is the whole point of the boundary.

---

## 9. What is enforced automatically

`backend/tests/test_contracts.py`, 12 tests, all currently passing:

| Test | Guards |
| --- | --- |
| `test_coordinate_to_geojson_uses_lon_lat_order` | §1.1 axis order |
| `test_time_window_rejects_naive_datetime` | §1.2 |
| `test_time_window_rejects_non_utc_offset` | §1.2 |
| `test_time_window_accepts_utc` | §1.2 |
| `test_mock_detection_fixture_validates` × 3 | §2 against OS-001/002/003 |
| `test_mock_drift_fixture_validates` × 3 | §3 against OS-001/002/003 |
| `test_mock_attribution_fixture_validates` | §5 against OS-001 |
| `test_invalid_detection_payload_fails_validation` | rejection actually rejects |

The checked-in fixtures under `data/cases/` are validated against the live schemas on every run, so a schema change that breaks the contract fails the suite rather than surfacing later.

**What these tests do not prove:** that two people read this document the same way. That is a human check — see `docs/staged-build-reference.md` Stage 1's Human Decision Gate, whose test is that two people independently hand-encode the same spill from this document and the two files match field for field.

---

## 10. Not yet frozen — open items

Listed so an unspecified field reads as a known gap. Each needs a decision before the stage that depends on it is built.

1. **`DriftResult.uncertainty` is `dict | None` — completely untyped.** This is where the ensemble probability field / cone goes. Nothing about its shape, containment level, or grid representation is specified, so Stage C and the frontend cannot currently agree on it. This is the largest gap in this document.
2. **Score scales are inconsistent** (§1.4). Detection confidence is 0–1; vessel scores and features are 0–100; `TriageConfidence.value` has no constraint at all. Either unify, or state the split deliberately.
3. **Triage radii are placeholders.** `TRIAGE_PLATFORM_RADIUS_KM=5.0` and `TRIAGE_PIPELINE_RADIUS_KM=2.0` are marked "not yet team-approved" in both `.env.example` and `config.py`. They should be set against the origin estimate's own spatial tolerance, which `HindcastResult` does not currently carry — see item 5.
4. **Timestamps typed as `str`.** `CaseSummary.investigation_timestamp`, `CaseSummary.detection_timestamp` and `CaseMeta.date` bypass the UTC enforcement that every other datetime field gets.
5. **The origin estimate has no spatial tolerance field.** `HindcastResult` carries `origin` and `origin_time_window` but no radius or uncertainty on the point. Triage radius calibration and Stage D candidate filtering both need it.
6. **`SpillGeometry.polygon` is `Polygon` only.** Disconnected patches of oil — common in practice — have no representation. Either `MultiPolygon`, or a decision that each patch is a separate detection.
7. **GeoJSON coordinate arrays are unvalidated for length.** `GeoJSONPoint.coordinates` is `list[float]`; a 5-element array validates.
8. **`provenance` is `dict[str, str]`, untyped.** Its keys are unspecified in both `InvestigationReport` and `InvestigationCase`.
9. **`VesselFeatures` carries only the two MVP features.** Dark-gap, behavioural-anomaly and track-integrity scores have no fields yet.
10. **`possible-natural-seep` is unreachable** — in the enum, never emitted. Intentional, but worth stating rather than leaving a consumer to wonder.
11. **`docs/decisions.md` does not exist.** It is referenced by `app/schemas/attribution.py` and `app/core/config.py` as the record for the `low_confidence` addition and the placeholder thresholds. Second dangling doc reference in this repo — this document was the first.

---

## 11. Changing this contract

These objects cross boundaries between stages built independently, so a change here is not a local change.

1. Change `backend/app/schemas/` first — it is the source of truth.
2. Update the fixtures in `data/cases/` so `test_contracts.py` still passes; a schema change that leaves fixtures stale fails the suite, which is the intended behaviour.
3. Update this document in the same change.
4. Additive-and-optional changes (a new optional field) do not break existing consumers. Anything else — a new required field, a narrowed type, a renamed field, a changed enum value — does, and needs the owners of the affected stages to know before it lands.

If this document is unclear or silent on something you need, that is a defect in this document. Flag it and get it resolved rather than writing code around an assumption — the same discipline `prd.md` and `docs/staged-build-reference.md` both apply to themselves.
