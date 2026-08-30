# PRD
# SIH 2026 — Satellite-Based Oil Spill Detection, Drift Modelling & AIS-Correlated Vessel Attribution

Version: 1.0
Project Type: Smart India Hackathon 2026
Primary Developer Role: Stage B + Stage E + Backend/Integration + Frontend

---

# 1. PRODUCT OVERVIEW

## 1.1 Product Name

Satellite-Based Oil Spill Investigation & Attribution Platform

Working product concept:

An end-to-end decision-support platform that takes the outputs of satellite-based oil-spill detection, source-type triage, ocean drift modelling, and AIS vessel attribution and presents them as one explainable investigation workflow.

The platform is intended to help a maritime pollution-response or investigative analyst understand:

1. Where an oil spill was detected.
2. Whether the detection is likely a real spill or a look-alike.
3. What type of source may have caused it.
4. Where the spill most likely originated.
5. Where the spill is likely to move.
6. Which vessels, if applicable, are the strongest investigative leads.
7. Why each hypothesis/lead was produced.
8. All of the above in a structured investigation dossier.

The system is a DECISION-SUPPORT TOOL.

It is NOT a legal determination system.

The following statement must appear in the final report:

"this is a decision-support lead list, not a legal determination."

This wording must be preserved verbatim.

---

# 2. IMPORTANT DEVELOPMENT BOUNDARY

The development team is divided into multiple owners.

This repository is owned by the developer responsible for:

- Stage B — Source-Type Triage
- Stage E — Investigator's Dossier
- Backend/API
- Cross-stage integration
- Frozen interface contracts
- React frontend
- Mapbox visualization

Do NOT implement the internal algorithms of:

- Stage A — SAR segmentation
- Stage C — OpenDrift/OpenOil modelling
- Stage D — AIS scoring

unless explicitly requested.

These stages are upstream/downstream dependencies.

Treat them as external modules/services with stable interfaces.

The application must be able to operate initially using MOCK implementations of Stages A, C and D.

This allows the integration layer and frontend to be developed before the other team members finish their implementations.

---

# 3. PRODUCT GOAL

Build a polished investigation application in which an analyst can select a curated spill case and walk through a linear investigation:

CASE SELECTION
        ↓
SPILL DETECTION
        ↓
SOURCE-TYPE TRIAGE
        ↓
BACKWARD DRIFT / ORIGIN
        ↓
VESSEL ATTRIBUTION (only if applicable)
        ↓
FORWARD FORECAST
        ↓
INVESTIGATION DOSSIER

The frontend must present this as a narrative investigation rather than a generic analytics dashboard.

---

# 4. CORE PRODUCT PRINCIPLES

## 4.1 Explainability

Every important result must have an evidence explanation.

Do not display only:

"Likely Vessel"

Instead show why:

- proximity to origin
- trajectory alignment
- distance to pipeline
- distance to platform
- relevant time window
- available supporting evidence

---

## 4.2 Uncertainty Awareness

Do not present model outputs as absolute truth.

Stage A confidence is an indicative, uncalibrated model score.

Never describe raw segmentation probabilities as calibrated statistical probabilities.

Use wording such as:

"Indicative detection confidence"

rather than:

"87% probability this is definitely oil."

---

## 4.3 Non-accusatory Attribution

The system must NEVER say:

"Vessel X caused the spill."

Instead say:

"Vessel X is the highest-priority investigative lead."

All vessel attribution is investigative prioritization.

---

## 4.4 Source-Type Triage Before Vessel Attribution

A spill must NOT automatically be attributed to a vessel.

Stage B must first determine whether the estimated origin is plausibly associated with:

- vessel
- offshore platform
- offshore pipeline
- natural seep
- insufficient evidence

Stage D vessel attribution should only execute when Stage B produces:

"likely-vessel"

or when Stage B produces:

"insufficient-evidence" and the system intentionally allows low-confidence vessel investigation.

---

## 4.5 Curated Demo First

The MVP frontend must use 2–3 curated, pre-verified demo cases.

At least one must be a real documented historical spill with a known origin location and time.

Do NOT make arbitrary SAR image upload the primary demo path.

User-uploaded SAR images are a stretch feature.

---

# 5. MVP SCOPE

The MVP must support:

## Stage B

- platform proximity check
- pipeline proximity check
- source hypothesis
- confidence/strength indicator
- evidence breakdown
- correct routing to/from Stage D

## Backend

- REST API
- Pydantic contracts
- integration adapters
- mock upstream services
- investigation orchestration
- case management
- report generation

## Stage E

- structured investigation dossier
- spill summary
- source hypothesis
- drift summary
- vessel leads when applicable
- required disclaimer

## Frontend

- world map
- case selection
- Mapbox
- guided wizard
- spill polygon
- source hypothesis
- origin/drift visualization
- vessel points when relevant
- final dossier view

---

# 6. NON-MVP FEATURES

These must NOT delay the MVP.

## WORTH ADDING

- full evidence breakdown for vessels
- dark-gap attribution information
- behavioral information
- AIS integrity information
- confidence tiers
- forecast/attribution map toggle
- vessel color/size coding
- polished PDF export
- additional historical cases

## STRETCH

- natural seep detection
- repeated-origin pattern detection
- live SAR upload
- animated drift probability cloud
- time slider
- deck.gl/kepler.gl
- historical base-rate scoring

If there is uncertainty about whether a feature is MVP, default to NOT implementing it until explicitly approved.

---

# 7. SYSTEM ARCHITECTURE

High-level architecture:

                    STAGE A
              SAR Detection
                    │
                    ▼
             DetectionResult
                    │
                    ▼
              ┌────────────┐
              │   STAGE B  │
              │ Source     │
              │ Triage     │
              └─────┬──────┘
                    │
           ┌────────┴─────────┐
           │                  │
     stationary source    likely vessel
           │                  │
           │                  ▼
           │              STAGE C
           │            Drift Model
           │                  │
           │                  ▼
           │              STAGE D
           │          Vessel Attribution
           │                  │
           └────────┬─────────┘
                    ▼
               STAGE E
             Investigation
                Dossier
                    │
                    ▼
              FastAPI API
                    │
                    ▼
             React Frontend
                    │
                    ▼
                Mapbox


---

# 8. DATA FLOW

The canonical investigation object is:

InvestigationCase

It aggregates outputs from all stages.

Conceptually:

InvestigationCase
├── case metadata
├── detection
├── triage
├── drift
├── attribution
├── report
└── provenance


The frontend should primarily consume this aggregate rather than directly understanding internal implementation details of each stage.

---

# 9. FROZEN INTERFACE CONTRACTS

The following must be established before implementing integration.

All stage owners must use these concepts consistently.

## 9.1 Coordinate System

Canonical API spatial coordinates:

WGS84 / EPSG:4326

Coordinates must be represented explicitly as:

{
  "lat": number,
  "lon": number
}

GeoJSON must follow standard GeoJSON coordinate ordering:

[longitude, latitude]

Never silently swap latitude and longitude.

---

# 10. TIME CONTRACT

All backend timestamps must be stored/transmitted in UTC.

Use ISO 8601 format.

Example:

2026-08-29T12:30:00Z

Never pass ambiguous local timestamps between stages.

Frontend may convert UTC to local display time.

Backend logic must remain UTC.

---

# 11. STAGE A CONTRACT

Stage A is owned by another developer.

The integration layer expects:

DetectionResult

Example:

{
  "case_id": "OS-001",
  "detected_at": "2026-08-29T10:30:00Z",

  "spill": {
    "centroid": {
      "lat": 15.2300,
      "lon": 67.4200
    },

    "polygon": {
      "type": "Polygon",
      "coordinates": []
    },

    "area_km2": 5.2,
    "perimeter_km": 11.4,
    "elongation": 2.8,
    "coastline_distance_km": 42.0
  },

  "detection_confidence": {
    "value": 0.87,
    "type": "indicative_uncalibrated",
    "label": "Indicative detection confidence"
  }
}

The actual Stage A implementation may differ internally.

The integration layer must adapt the implementation to this contract.

---

# 12. STAGE C CONTRACT

Stage C is owned by another developer.

The integration layer expects:

DriftResult

Example:

{
  "case_id": "OS-001",

  "hindcast": {
    "origin": {
      "lat": 15.0100,
      "lon": 66.9100
    },

    "origin_time_window": {
      "start": "2026-08-29T06:00:00Z",
      "end": "2026-08-29T10:00:00Z"
    },

    "path": {
      "type": "LineString",
      "coordinates": []
    }
  },

  "forecast": {
    "path": {
      "type": "LineString",
      "coordinates": []
    },

    "time_to_coastline_hours": 18.0,

    "time_to_sensitive_zone_hours": null
  },

  "uncertainty": null
}

If ensemble modelling is later implemented:

uncertainty may contain a probability field/cone.

The frontend must be capable of receiving this without requiring it for MVP.

---

# 13. STAGE D CONTRACT

Stage D is owned by another developer.

The integration layer expects:

AttributionResult

Example:

{
  "case_id": "OS-001",

  "executed": true,

  "data_disclosure": {
    "ais_type": "synthetic",
    "description": "Synthetic AIS tracks generated for controlled validation."
  },

  "candidates": [
    {
      "vessel_id": "MMSI-001",
      "vessel_name": "Vessel Alpha",

      "score": 88.0,

      "confidence_tier": "High",

      "features": {
        "proximity": 92.0,
        "trajectory_alignment": 84.0
      },

      "evidence": [
        "Vessel track passed near estimated origin",
        "Trajectory aligned with backward drift path"
      ]
    }
  ]
}

The system must not imply that synthetic AIS represents real vessel traffic.

---

# 14. STAGE B — SOURCE-TYPE TRIAGE

## 14.1 Purpose

Determine what kind of source is plausible at the estimated spill origin.

This prevents the system from automatically blaming a moving vessel when the source may be stationary.

---

# 15. STAGE B INPUT

Stage B requires:

- estimated origin point from Stage C
- infrastructure dataset
- platform locations
- pipeline routes
- optional seep data if implemented
- configurable proximity thresholds

Example:

origin:

{
  "lat": 15.01,
  "lon": 66.91
}

---

# 16. STAGE B INFRASTRUCTURE SOURCES

Primary data sources can include:

- public oil and gas infrastructure datasets
- Global Energy Monitor
- OpenStreetMap

Pipeline routes may use:

- OpenStreetMap

If public coverage for the selected demo region is poor:

USE A SMALL HAND-VERIFIED STATIC LIST.

Do not allow missing external data to break the demo.

The static fallback must be clearly documented.

---

# 17. STAGE B CHECKS

## 17.1 Platform proximity

Check whether the estimated origin point is within the configured threshold of a known offshore platform.

Output:

platform_nearby: true/false

nearest_platform_distance_km

nearest_platform_id

nearest_platform_location

---

## 17.2 Pipeline proximity

Check whether the estimated origin point is sufficiently close to a known offshore pipeline route.

This requires point-to-line distance.

Output:

pipeline_nearby: true/false

nearest_pipeline_distance_km

nearest_pipeline_id

---

## 17.3 Natural seep

MVP:

Do not require natural seep detection.

STRETCH:

Check whether origin overlaps a documented natural seep zone.

---

# 18. STAGE B HYPOTHESIS ENUMERATION

Use exactly these hypothesis concepts:

likely-vessel

likely-platform

likely-pipeline

possible-natural-seep

insufficient-evidence

Do not introduce alternative labels without updating the contract.

---

# 19. STAGE B DECISION LOGIC

The system should use transparent deterministic rules.

Do NOT use a black-box ML classifier for Stage B.

The logic must be explainable.

Example conceptual logic:

IF origin is within configured platform threshold
AND platform evidence is stronger than competing source evidence:

    hypothesis = likely-platform

ELSE IF origin is within configured pipeline threshold
AND pipeline evidence is stronger than competing source evidence:

    hypothesis = likely-pipeline

ELSE IF vessel evidence is available and no stationary source explains origin:

    hypothesis = likely-vessel

ELSE:

    hypothesis = insufficient-evidence

Natural seep is optional/stretch.

IMPORTANT:

Do not hard-code arbitrary threshold values without documenting them.

Thresholds must be configuration values.

---

# 20. STAGE B OUTPUT

Example:

{
  "hypothesis": "likely-platform",

  "confidence": {
    "tier": "High",
    "value": null,
    "type": "rule_based"
  },

  "evidence": {
    "nearest_platform_distance_km": 1.8,
    "nearest_pipeline_distance_km": 47.2,
    "vessel_evidence_available": true
  },

  "routing": {
    "run_vessel_attribution": false
  }
}

---

# 21. STAGE B EVIDENCE REQUIREMENTS

Every hypothesis must contain human-readable evidence.

Example:

Hypothesis:
Likely Platform

Evidence:

- Estimated origin is 1.8 km from Platform P-17.
- Nearest known pipeline is 47.2 km away.
- Stationary infrastructure provides stronger source evidence than available vessel evidence.

The UI should display this evidence.

---

# 22. STAGE B ROUTING

If:

likely-platform

THEN:

Stage D must NOT run.

If:

likely-pipeline

THEN:

Stage D must NOT run.

If:

possible-natural-seep

THEN:

Stage D must NOT run.

If:

likely-vessel

THEN:

Stage D may run.

If:

insufficient-evidence

THEN:

The system may expose low-confidence vessel investigation.

This must be clearly labelled as low confidence.

---

# 23. STAGE E — INVESTIGATOR'S DOSSIER

Stage E does NO modelling.

Stage E is a reporting/presentation layer.

It consumes existing outputs from Stages A–D.

Never create new scientific inference inside Stage E.

Stage E should compile:

Stage A
+
Stage B
+
Stage C
+
Stage D when applicable

into one structured report.

---

# 24. REPORT SECTIONS

The MVP report must contain:

## 24.1 Case Information

- Case ID
- Investigation timestamp
- Detection timestamp
- Region

---

## 24.2 Spill Detection Summary

- detected location
- spill centroid
- spill polygon
- area
- perimeter
- elongation/aspect ratio
- coastline distance
- indicative detection confidence
- look-alike awareness

---

## 24.3 Source Hypothesis

Display:

- hypothesis
- confidence/strength
- supporting evidence
- nearest platform
- nearest pipeline
- relevant routing decision

---

## 24.4 Drift Summary

Display:

- estimated origin
- estimated origin time window
- backward drift path
- forward forecast
- time to coastline
- time to sensitive zone if available

---

## 24.5 Vessel Attribution

Only display if Stage B permits vessel investigation.

Display:

- ranked vessel list
- vessel identifier/name
- overall score
- proximity score
- trajectory score
- confidence tier if available
- evidence explanation

Also show:

AIS data disclosure:

"The vessel attribution demonstration uses synthetic AIS data for controlled validation."

Do not hide this disclosure.

---

## 24.6 Final Disclaimer

Every generated report must include exactly:

"this is a decision-support lead list, not a legal determination."

The disclaimer must be visually prominent.

---

# 25. STAGE E WORTH-ADDING

If time permits:

- full feature-level evidence breakdown
- dark-gap evidence
- behavioral evidence
- AIS integrity evidence
- alternative vessel hypotheses
- polished PDF export
- report provenance
- dataset/source listing

---

# 26. REPORT DATA MODEL

Create a structured:

InvestigationReport

Example:

{
  "case_id": "OS-001",

  "summary": {},

  "detection": {},

  "source_hypothesis": {},

  "drift": {},

  "attribution": {},

  "provenance": {},

  "limitations": [],

  "disclaimer": "this is a decision-support lead list, not a legal determination."
}

The report must be serializable to JSON.

PDF generation must consume this structured object rather than independently querying multiple stages.

---

# 27. BACKEND

Use:

Python 3.11+

FastAPI

Pydantic

GeoPandas

Shapely

PyProj

Jinja2

ReportLab

Pytest

Ruff

---

# 28. BACKEND STRUCTURE

Recommended:

backend/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── cases.py
│   │   ├── investigation.py
│   │   ├── detection.py
│   │   ├── triage.py
│   │   ├── drift.py
│   │   ├── attribution.py
│   │   └── report.py
│   │
│   ├── schemas/
│   │   ├── common.py
│   │   ├── detection.py
│   │   ├── triage.py
│   │   ├── drift.py
│   │   ├── attribution.py
│   │   ├── investigation.py
│   │   └── report.py
│   │
│   ├── services/
│   │   ├── case_service.py
│   │   ├── triage_service.py
│   │   ├── investigation_service.py
│   │   └── report_service.py
│   │
│   ├── integrations/
│   │   ├── stage_a.py
│   │   ├── stage_c.py
│   │   └── stage_d.py
│   │
│   ├── data/
│   │   ├── infrastructure.py
│   │   ├── demo_cases.py
│   │   └── repositories/
│   │
│   └── core/
│       ├── config.py
│       ├── logging.py
│       └── errors.py
│
├── tests/
│   ├── test_triage.py
│   ├── test_contracts.py
│   ├── test_investigation.py
│   └── test_reports.py
│
└── pyproject.toml

---

# 29. API ENDPOINTS

## GET /api/health

Returns backend health.

Response:

{
  "status": "ok"
}

---

## GET /api/cases

Return available curated demo cases.

Response:

{
  "cases": [
    {
      "case_id": "OS-001",
      "name": "Historical Case 1",
      "region": "...",
      "date": "...",
      "is_historical_ground_truth": true
    }
  ]
}

---

## GET /api/cases/{case_id}

Return metadata for one case.

---

## POST /api/detect

Accept or execute Stage A detection.

For MVP, support both:

- real Stage A integration
- mock Stage A result

---

## POST /api/triage

Input:

DetectionResult
+
Drift origin
+
Infrastructure data

Output:

TriageResult

---

## POST /api/drift

Integration endpoint for Stage C.

For the integration environment, support mock output.

---

## POST /api/attribute

Run Stage D only if allowed by Stage B.

If Stage B says:

likely-platform

likely-pipeline

possible-natural-seep

then return:

{
  "executed": false,
  "reason": "Stage B determined that vessel attribution is not applicable."
}

Do not call Stage D.

---

## POST /api/investigation/run

This is the main orchestration endpoint.

Input:

{
  "case_id": "OS-001"
}

Execution:

1. Load case.
2. Obtain Stage A result.
3. Obtain Stage C result.
4. Run Stage B.
5. Decide whether Stage D is applicable.
6. Run Stage D if applicable.
7. Compile Stage E report.
8. Return InvestigationCase.

---

## GET /api/investigation/{case_id}

Return the current investigation state.

---

## POST /api/report/{case_id}

Generate the structured report.

Optional:

PDF generation.

---

# 30. INVESTIGATION ORCHESTRATOR

Create:

InvestigationService

It should coordinate the entire pipeline.

Pseudo-flow:

load_case()

stage_a_result = detection_adapter.get_result()

stage_c_result = drift_adapter.get_result()

triage_result = triage_service.evaluate(
    origin=stage_c_result.hindcast.origin,
    infrastructure=...
)

if triage_result.routing.run_vessel_attribution:
    attribution_result = attribution_adapter.get_result()
else:
    attribution_result = AttributionResult(
        executed=False
    )

report = report_service.generate(
    detection=stage_a_result,
    triage=triage_result,
    drift=stage_c_result,
    attribution=attribution_result
)

return InvestigationCase(...)

---

# 31. MOCK SERVICES

Before real teammate modules are integrated, the backend MUST work using deterministic mock data.

Create:

backend/app/integrations/mock/

or equivalent.

Mocks must represent:

- Stage A
- Stage C
- Stage D

The mock system must include at least:

### Case 1 — Vessel hypothesis

Stage B → likely-vessel

Stage D executes.

### Case 2 — Platform hypothesis

Stage B → likely-platform

Stage D does NOT execute.

### Case 3 — Pipeline hypothesis

Stage B → likely-pipeline

Stage D does NOT execute.

This is essential for demonstrating that Stage B actually prevents force-fitting vessel attribution.

---

# 32. FRONTEND

Technology:

React

TypeScript

Vite

Mapbox GL JS

Tailwind CSS

Framer Motion

Lucide React

Axios

Recharts if needed

Turf.js

State management:

React useState/useContext where appropriate.

Do NOT install Redux.

Do NOT install Zustand unless explicitly required later.

---

# 33. FRONTEND PRODUCT PHILOSOPHY

The frontend is NOT a generic dashboard.

It is a guided investigation narrative.

The user should feel like they are investigating an incident.

The interface should progressively reveal evidence.

Avoid displaying all information at once.

---

# 34. FRONTEND CORE FLOW

Step 0:

LANDING

Interactive world map.

Left sidebar.

CTA:

"Start Investigation"

---

Step 1:

CASE SELECTION

Dropdown containing 2–3 curated cases.

Each case should show:

- case name
- region
- date
- historical/demo label

At least one case must be a real documented historical case.

---

Step 2:

DETECTION

Map flies to the selected region.

Use Mapbox flyTo.

Show:

- spill polygon
- spill centroid
- detection information
- indicative confidence
- spill area
- perimeter
- elongation

---

Step 3:

SOURCE TRIAGE

Reveal the source hypothesis.

Example:

SOURCE HYPOTHESIS

LIKELY VESSEL

Supporting evidence:

✓ No nearby pipeline
✓ No nearby platform
✓ Vessel evidence available

OR:

LIKELY PLATFORM

Supporting evidence:

✓ Origin is 1.8 km from known platform
✓ Pipeline is 47 km away
✓ Vessel attribution not triggered

---

Step 4:

ORIGIN / DRIFT

Show:

"Where did it come from?"

Map visualization:

- current spill location
- probable origin
- backward drift path
- origin time window

The map should animate or visually reveal the path where practical.

---

Step 5:

VESSEL ATTRIBUTION

Only show this step when Stage B allows vessel attribution.

Display:

- candidate vessel points
- ranked vessel list
- score
- proximity
- trajectory alignment
- evidence

Example:

#1 Vessel Alpha

88 / 100

Proximity: 92

Trajectory: 84

Evidence:
"Track passed within the estimated origin window and aligned with the backward drift path."

---

Step 6:

FORECAST

Show:

"Where is it going?"

Display:

- forward forecast
- forecast path
- time to coastline
- time to sensitive zone

Worth-adding:

Toggle:

[ Where did it come from ] [ Where is it going ]

---

Step 7:

FINAL DOSSIER

Display the full investigation report.

Sections:

- Case
- Detection
- Source hypothesis
- Origin
- Drift
- Vessel leads
- Evidence
- Limitations
- Disclaimer

Provide PDF export if implemented.

---

# 35. FRONTEND ROUTING

Recommended:

/

 /investigate

 /investigate/:caseId

 /investigate/:caseId/detection

 /investigate/:caseId/triage

 /investigate/:caseId/drift

 /investigate/:caseId/attribution

 /investigate/:caseId/report

However, the core flow should remain wizard-like.

Do not turn it into unrestricted navigation.

Back button is allowed.

---

# 36. FRONTEND COMPONENT STRUCTURE

frontend/src/

├── app/
│   ├── App.tsx
│   └── routes.tsx
│
├── pages/
│   ├── LandingPage.tsx
│   ├── InvestigationPage.tsx
│   └── ReportPage.tsx
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── StepIndicator.tsx
│   │
│   ├── map/
│   │   ├── InvestigationMap.tsx
│   │   ├── SpillLayer.tsx
│   │   ├── DriftLayer.tsx
│   │   ├── VesselLayer.tsx
│   │   ├── InfrastructureLayer.tsx
│   │   └── OriginMarker.tsx
│   │
│   ├── triage/
│   │   ├── SourceHypothesisCard.tsx
│   │   ├── EvidenceList.tsx
│   │   └── InfrastructureEvidence.tsx
│   │
│   ├── attribution/
│   │   ├── VesselRanking.tsx
│   │   ├── VesselCard.tsx
│   │   └── ScoreBreakdown.tsx
│   │
│   ├── detection/
│   │   └── SpillMetrics.tsx
│   │
│   ├── drift/
│   │   ├── OriginSummary.tsx
│   │   └── ForecastSummary.tsx
│   │
│   └── report/
│       ├── ReportView.tsx
│       ├── ReportSection.tsx
│       └── Disclaimer.tsx
│
├── services/
│   └── api.ts
│
├── types/
│   └── investigation.ts
│
├── hooks/
│   └── useInvestigation.ts
│
└── utils/
    ├── geojson.ts
    └── formatting.ts

---

# 37. MAPBOX REQUIREMENTS

Mapbox is the central visual component.

The map must support:

1. World view
2. Case region
3. Spill polygon
4. Spill centroid
5. Origin marker
6. Backward drift path
7. Forward forecast path
8. Platform locations
9. Pipeline routes
10. Vessel points

MVP vessel points are static.

Do not implement animated vessel tracks unless explicitly promoted to a later tier.

---

# 38. MAP LAYER MANAGEMENT

Use separate GeoJSON sources/layers.

Example:

spill-source

spill-fill

spill-outline

origin-source

origin-marker

hindcast-source

hindcast-line

forecast-source

forecast-line

platform-source

platform-symbol

pipeline-source

pipeline-line

vessel-source

vessel-circle

Keep each layer modular.

Do not put all map rendering into one giant component.

---

# 39. MAP INTERACTION

When a user selects a vessel:

Show a detail panel containing:

- vessel name/ID
- score
- score tier
- proximity
- trajectory
- evidence

When a user selects infrastructure:

Show:

- type
- ID/name
- distance from origin
- source information if available

When the spill is selected:

Show:

- area
- perimeter
- elongation
- confidence

---

# 40. VISUAL DESIGN

The application should look like a professional maritime intelligence/investigation tool.

Desired characteristics:

- dark/neutral maritime aesthetic
- clean typography
- restrained use of color
- strong map focus
- glass/solid panels where appropriate
- subtle motion
- clear hierarchy
- high information density without clutter

Avoid:

- generic Bootstrap-looking forms
- excessive gradients
- excessive neon colors
- unnecessary animations
- dashboard card overload
- huge headings consuming the map
- random decorative elements

Animation should support the investigation narrative.

---

# 41. RESPONSIVE DESIGN

Primary target:

Desktop/laptop.

The SIH demo will primarily run on a large screen.

Still support reasonable tablet widths.

Mobile is secondary.

---

# 42. STATE MANAGEMENT

Use a single investigation state.

Conceptually:

InvestigationState

{
  case,
  currentStep,
  detection,
  triage,
  drift,
  attribution,
  report,
  loading,
  error
}

Do not duplicate investigation data across multiple unrelated components.

---

# 43. API CLIENT

All frontend API communication must live in:

services/api.ts

Do not scatter fetch/axios calls throughout components.

Create typed methods:

getCases()

getCase()

runInvestigation()

getInvestigation()

runTriage()

getDrift()

getAttribution()

generateReport()

---

# 44. ERROR HANDLING

Every stage can fail.

The frontend must handle:

- backend unavailable
- stage timeout
- malformed response
- missing optional data
- Stage D intentionally skipped
- missing infrastructure data
- missing forecast
- report generation failure

Do not crash the entire application.

Show user-friendly states.

Example:

"Vessel attribution was not run because the source triage identified a likely pipeline source."

This is a valid state, not an error.

---

# 45. LOADING STATES

The investigation workflow should have clear loading states.

Examples:

"Loading spill detection..."

"Checking stationary infrastructure..."

"Tracing probable origin..."

"Correlating vessel tracks..."

"Compiling investigation dossier..."

These are UI labels only.

Do not fake progress percentages.

If the backend actually returns progress, display it.

Otherwise use indeterminate loading animations.

---

# 46. DATA PROVENANCE

Every major result should know where it came from.

Possible provenance:

- Stage A model
- Stage B rule engine
- Stage C OpenOil/OpenDrift
- Stage D synthetic AIS
- infrastructure dataset
- historical case database

The final report should be capable of showing this information.

---

# 47. SYNTHETIC DATA DISCLOSURE

The application must visibly disclose when AIS data is synthetic.

Use wording such as:

"AIS tracks shown in this demonstration are synthetically generated for controlled validation and do not represent live vessel traffic."

This disclosure should appear:

- in attribution UI
- in final report
- in limitations

Do not hide this limitation.

---

# 48. LIMITATIONS

The final report should support these known limitations:

1. AIS data in the demo is synthetic.
2. Detection confidence is indicative and uncalibrated.
3. Public platform/pipeline data may have incomplete coverage.
4. MVP vessel attribution uses proximity and trajectory.
5. Real-world AIS dark gaps may reduce attribution performance.
6. Drift accuracy is evaluated against a limited number of historical cases.
7. The system produces investigative hypotheses rather than legal conclusions.

---

# 49. STAGE B TESTING

Write unit tests for:

## Platform detection

Origin inside threshold:

Expected:

platform_nearby = true

---

## Platform negative

Origin outside threshold:

Expected:

platform_nearby = false

---

## Pipeline intersection/proximity

Origin close to pipeline:

Expected:

pipeline_nearby = true

---

## Vessel routing

No stationary source:

Expected:

likely-vessel

run_vessel_attribution = true

---

## Platform routing

Platform is strongest hypothesis:

Expected:

likely-platform

run_vessel_attribution = false

---

## Pipeline routing

Pipeline is strongest hypothesis:

Expected:

likely-pipeline

run_vessel_attribution = false

---

## Insufficient evidence

No source evidence:

Expected:

insufficient-evidence

low-confidence routing

---

# 50. INTEGRATION TESTS

At minimum:

## Test 1 — Vessel case

Stage A mock
→ Stage C mock
→ Stage B
→ Stage D
→ Stage E

Must produce complete report.

---

## Test 2 — Platform case

Stage A mock
→ Stage C mock
→ Stage B

Stage D must NOT run.

Stage E must still produce complete report.

---

## Test 3 — Pipeline case

Same as platform.

---

## Test 4 — Insufficient evidence

Stage D may be offered as low-confidence.

UI must clearly communicate uncertainty.

---

# 51. CONTRACT TESTING

Every upstream stage must be validated against Pydantic schemas.

If Stage A returns an invalid payload:

Do not silently accept it.

Return a clear validation error.

Example:

"Stage A response failed DetectionResult schema validation."

This will protect integration during Week 4.

---

# 52. DEMO CASES

The MVP should support 2–3 curated cases.

Recommended conceptual cases:

Case A:
Vessel hypothesis

Case B:
Platform hypothesis

Case C:
Pipeline hypothesis

At least one must be based on a real documented historical spill with known origin/time.

The cases should demonstrate that the system does NOT always blame vessels.

---

# 53. IMPORTANT DEMO BEHAVIOR

The strongest demo sequence should be:

1. Open world map.
2. Select a historical spill case.
3. Camera flies to incident.
4. Spill polygon appears.
5. Detection metrics appear.
6. Source triage appears.
7. Map shows infrastructure evidence.
8. System explains why vessel attribution is or isn't appropriate.
9. If vessel:
   - show drift origin
   - show candidate vessels
   - rank them
10. Show forward forecast.
11. Generate investigation dossier.
12. Show disclaimer.

---

# 54. EVALUATION SUPPORT

The backend should make it possible for the team to display evaluation results.

The project scope requires:

Stage A:
- IoU
- Dice
- per class
- mean

Stage D:
- Top-1 hit rate
- Top-3 hit rate
- false implication check

Stage C:
- origin distance error
- origin time error

These metrics are mainly generated by other stage owners.

Your integration/report layer should be capable of consuming and displaying them if provided.

Do not invent evaluation numbers.

---

# 55. IMPORTANT EVALUATION DISCLOSURE

Stage D evaluation uses self-generated synthetic scenarios.

The report/presentation must not imply that synthetic AIS evaluation proves performance on real-world AIS.

The correct framing is:

The evaluation validates the attribution mechanism against controlled ground truth. It does not establish generalization to real, messy AIS data.

---

# 56. STAGE C EVALUATION DISCLOSURE

If only one historical case is used:

The report/presentation should explicitly identify it as n=1.

Do not imply statistical significance.

---

# 57. CONFIGURATION

Thresholds and application settings must NOT be hardcoded into business logic.

Use configuration.

Example:

TRIAGE_PLATFORM_RADIUS_KM

TRIAGE_PIPELINE_RADIUS_KM

TRIAGE_VESSEL_LOW_CONFIDENCE_THRESHOLD

MAP_DEFAULT_ZOOM

MAP_DEFAULT_CENTER

API_TIMEOUT_SECONDS

Do not invent final values without team approval.

---

# 58. ENVIRONMENT VARIABLES

Use .env for secrets/configuration.

Example:

MAPBOX_TOKEN

API_BASE_URL

ENVIRONMENT

DEBUG

Do not commit .env.

Provide:

.env.example

---

# 59. SECURITY

For MVP:

- validate API inputs
- validate uploaded/received data
- never expose backend secrets
- never commit API keys
- never execute arbitrary uploaded files
- sanitize report inputs
- restrict CORS to configured frontend origin where appropriate

---

# 60. OBSERVABILITY

Backend should log:

- request ID
- case ID
- stage
- start/end
- success/failure
- validation errors

Do not log secrets.

---

# 61. PERFORMANCE

MVP does not require distributed systems.

Keep architecture simple.

Prefer:

FastAPI
+
in-memory/demo repository
+
file-based curated datasets

over:

microservices
Kubernetes
message queues
Redis
complex databases

unless later proven necessary.

---

# 62. DATABASE

Do NOT introduce PostgreSQL for the MVP unless there is a demonstrated requirement.

Curated demo cases can initially be stored as:

JSON/GeoJSON files.

Example:

data/
├── cases/
│   ├── OS-001/
│   ├── OS-002/
│   └── OS-003/
│
├── infrastructure/
│   ├── platforms.geojson
│   └── pipelines.geojson
│
└── mock/
    ├── detection/
    ├── drift/
    └── attribution/

---

# 63. GEOJSON STANDARD

All frontend spatial objects should be represented as GeoJSON whenever practical.

Examples:

Spill polygon:
Polygon

Drift path:
LineString

Vessel locations:
FeatureCollection<Point>

Platforms:
FeatureCollection<Point>

Pipelines:
FeatureCollection<LineString>

Origin:
Point

Do not invent custom coordinate structures for frontend-only map data.

---

# 64. REPORT EXPORT

MVP:

In-app report view.

WORTH ADDING:

PDF export.

If PDF export is implemented:

Use ReportLab or an equivalent controlled server-side renderer.

The PDF should visually resemble an investigation dossier.

It should contain:

- title
- case information
- map snapshot if technically available
- detection summary
- source hypothesis
- drift summary
- vessel leads
- evidence
- limitations
- disclaimer

---

# 65. NO NEW MODELLING IN STAGE E

This is a strict architectural rule.

Stage E must not:

- predict vessel guilt
- recalculate drift
- run segmentation
- modify AIS scores
- create new scientific conclusions

It only formats and explains outputs already produced.

---

# 66. NO NEW ML IN STAGE B

Stage B is intended to be explainable source triage.

Use:

- geospatial distance
- proximity
- deterministic rules
- infrastructure evidence

Do not introduce an ML classifier without explicit team approval.

---

# 67. ARCHITECTURAL EXTENSIBILITY

The application should allow later replacement of:

MockStageA → RealStageA

MockStageC → RealStageC

MockStageD → RealStageD

without changing:

- frontend
- report generation
- Stage B logic
- investigation orchestration contract

Use adapter interfaces.

---

# 68. ADAPTER PATTERN

Define interfaces conceptually:

DetectionProvider

DriftProvider

AttributionProvider

Then implementations:

MockDetectionProvider

RealDetectionProvider

MockDriftProvider

RealDriftProvider

MockAttributionProvider

RealAttributionProvider

This allows parallel development.

---

# 69. DEFINITION OF DONE — MVP

The project is MVP-complete when:

[ ] Frontend launches successfully.

[ ] Backend launches successfully.

[ ] Mapbox renders.

[ ] User can select a curated case.

[ ] Map flies to the case.

[ ] Spill polygon renders.

[ ] Detection information renders.

[ ] Stage B calculates source hypothesis.

[ ] Platform proximity works.

[ ] Pipeline proximity works.

[ ] Stage B routing works.

[ ] Vessel attribution is only executed when permitted.

[ ] Mock Stage C works.

[ ] Mock Stage D works.

[ ] InvestigationCase aggregates all outputs.

[ ] Final dossier renders.

[ ] Required disclaimer appears.

[ ] Synthetic AIS disclosure appears.

[ ] API contracts are validated.

[ ] Tests pass.

[ ] No API keys are committed.

[ ] A complete end-to-end demo works without external services failing.

---

# 70. DEFINITION OF DONE — INTEGRATION

Integration is complete when:

Real Stage A output can replace mock Stage A.

Real Stage C output can replace mock Stage C.

Real Stage D output can replace mock Stage D.

No frontend changes are required merely because mocks were replaced.

All three real modules satisfy frozen schemas.

---

# 71. DEFINITION OF DONE — FRONTEND

The frontend is complete when a judge can understand the investigation without seeing source code.

A user should be able to answer:

"What was detected?"

"Where is it?"

"What is the likely source?"

"Why?"

"Where did it probably come from?"

"Which vessels are investigative leads?"

"Why are they ranked this way?"

"Where is the oil going?"

"What are the limitations?"

without needing a technical explanation from the developer.

---

# 72. DEVELOPMENT PHASES

## PHASE 1 — Architecture

Build:

- repository structure
- Pydantic schemas
- API contracts
- mock data
- configuration
- CLAUDE.md
- README

Do not build visual polish yet.

---

## PHASE 2 — Stage B

Build:

- infrastructure repository
- platform proximity
- pipeline proximity
- triage engine
- hypothesis output
- evidence output
- routing decision

Write tests.

---

## PHASE 3 — Backend

Build:

- FastAPI
- API routes
- investigation orchestrator
- adapters
- case repository
- error handling
- logging

Make complete mock investigation run.

---

## PHASE 4 — Frontend Foundation

Build:

- React app
- layout
- Mapbox
- wizard state
- sidebar
- step indicator
- API client

---

## PHASE 5 — Frontend Investigation Flow

Build:

- case selection
- detection view
- triage view
- drift view
- attribution view
- report view

---

## PHASE 6 — Stage E

Build:

- structured report model
- report generator
- evidence formatting
- limitations
- disclaimer
- in-app dossier

---

## PHASE 7 — Real Integration

Replace mocks one stage at a time:

Stage A

then Stage C

then Stage D

Run contract tests after each integration.

---

## PHASE 8 — Polish

Only after end-to-end functionality works:

- animations
- visual refinement
- map transitions
- evidence visualization
- vessel highlighting
- forecast/attribution toggle
- PDF export
- additional demo cases

---

# 73. GIT WORKFLOW

Use feature branches.

Examples:

feature/stage-b-triage

feature/backend-contracts

feature/frontend-map

feature/reporting

feature/integration-stage-a

feature/integration-stage-c

feature/integration-stage-d

Do not develop everything directly on main.

Commit frequently.

Use meaningful commit messages.

---

# 74. CODE QUALITY

Use:

Ruff

Pytest

TypeScript strict mode

ESLint

Prettier

All important functions should have clear types.

Avoid giant functions.

Avoid giant React components.

Avoid duplicated business logic.

Avoid magic numbers.

Avoid hardcoded API URLs.

Avoid hardcoded secrets.

---

# 75. CLAUDE CODE BEHAVIOR

Claude Code must follow these rules:

1. Read PRD.md before implementing.
2. Read CLAUDE.md before implementing.
3. Do not implement another teammate's stage.
4. Do not silently change frozen contracts.
5. Ask for clarification if a contract is genuinely ambiguous.
6. Prefer mocks when upstream implementations are unavailable.
7. Write tests with business logic.
8. Run tests after changes.
9. Keep commits logically separated.
10. Do not install unnecessary libraries.
11. Do not rewrite working code without a reason.
12. Preserve the MVP/WORTH ADDING/STRETCH boundaries.
13. Never invent real-world data.
14. Clearly label synthetic data.
15. Never call an investigative lead a confirmed culprit.
16. Never present uncalibrated model scores as calibrated probabilities.

---

# 76. CLAUDE IMPLEMENTATION STRATEGY

Claude must work incrementally.

Do NOT attempt to generate the entire application in one operation.

For every phase:

1. Inspect current code.
2. Explain intended changes.
3. Implement small coherent changes.
4. Run tests/type checks.
5. Fix failures.
6. Update documentation.
7. Only then proceed.

---

# 77. FIRST CLAUDE CODE TASK

When this PRD is first provided to Claude Code:

DO NOT immediately build the application.

First:

1. Read PRD.md.
2. Read CLAUDE.md if present.
3. Inspect repository.
4. Audit installed dependencies.
5. Identify conflicts or missing packages.
6. Propose repository structure.
7. Design Pydantic contracts.
8. Design TypeScript types matching those contracts.
9. Design API routes.
10. Design mock case data.
11. Design Stage B decision logic.
12. Identify any ambiguity in this PRD.
13. Produce an implementation plan.

Then wait for approval before writing major application code.

---

# 78. FIRST IMPLEMENTATION MILESTONE

After approval, implement ONLY:

- repository structure
- backend skeleton
- Pydantic schemas
- Stage A mock
- Stage C mock
- Stage D mock
- infrastructure mock data
- Stage B engine
- unit tests
- /health
- /cases
- /triage
- /investigation/run

At the end of this milestone:

A complete backend investigation should work from mocked inputs.

---

# 79. SECOND IMPLEMENTATION MILESTONE

Implement frontend foundation:

- React
- TypeScript
- Mapbox
- layout
- sidebar
- step indicator
- case selector
- investigation state
- API service

The frontend must connect to the mock backend.

---

# 80. THIRD IMPLEMENTATION MILESTONE

Implement the complete wizard:

CASE
→ DETECTION
→ TRIAGE
→ DRIFT
→ ATTRIBUTION
→ FORECAST
→ REPORT

Use mock data until real stages are available.

---

# 81. FOURTH IMPLEMENTATION MILESTONE

Replace mock integrations one by one.

For each stage:

1. Validate upstream response.
2. Adapt to frozen schema.
3. Run contract tests.
4. Run end-to-end investigation.
5. Verify frontend.
6. Verify report.

Do not simultaneously integrate all three stages.

---

# 82. SUCCESS CRITERIA

The project succeeds if it demonstrates a coherent chain:

Satellite detection

→ source-type reasoning

→ probable origin

→ vessel attribution when appropriate

→ forward forecast

→ explainable investigation report

The core differentiation is NOT merely the segmentation model.

The value of this product is the integration, explainability, multi-hypothesis source triage, uncertainty awareness, and investigation-oriented presentation.

---

# 83. FINAL PRODUCT POSITIONING

Use this conceptual product description:

"An open, explainable decision-support platform for investigating maritime oil spills by combining satellite detection, source-type triage, ocean drift modelling, and AIS-correlated vessel attribution into a guided evidence-based investigation workflow."

Do not claim:

- legal attribution
- definitive vessel guilt
- live AIS capability
- calibrated probability unless actually implemented
- universal real-world accuracy

---

# 84. FINAL PRIORITY ORDER

When there is a conflict between features, prioritize:

1. Correctness
2. Frozen contracts
3. End-to-end integration
4. Stage B correctness
5. Stage E completeness
6. Frontend usability
7. Explainability
8. Testing
9. Visual polish
10. WORTH ADDING features
11. STRETCH features

Never sacrifice an MVP feature for a stretch feature.

END OF PRD