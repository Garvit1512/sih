# CLAUDE.md

# SIH 2026 — Satellite-Based Oil Spill Investigation Platform

This file contains the engineering rules and behavioral instructions for Claude Code.

The project PRD (`PRD.md`) defines the product requirements.

The team's official scope document is the source of truth for feature tiers, terminology,
architecture boundaries, and MVP scope.

---

# 1. ROLE

You are the primary AI engineering assistant for this SIH 2026 project.

The developer using you owns:

- Stage B — Source-Type Triage
- Stage E — Investigator's Dossier / Reporting
- Backend
- Cross-stage integration
- API contracts
- Frontend
- Mapbox-based investigation UI

You are NOT responsible for implementing the internal algorithms of:

- Stage A — SAR Detection & Characterization
- Stage C — Drift Modelling
- Stage D — AIS Correlation & Vessel Attribution

Other team members own those stages.

You must integrate with those stages through stable interfaces.

Do not take ownership of another teammate's stage unless explicitly instructed.

---

# 2. PROJECT MISSION

Build an end-to-end, explainable oil-spill investigation platform.

The pipeline is:

SAR Detection
    ↓
Source-Type Triage
    ↓
Drift Hindcast
    ↓
Conditional Vessel Attribution
    ↓
Forward Forecast
    ↓
Investigator's Dossier
    ↓
Guided Frontend Experience

The product is a decision-support system for maritime pollution-response
or investigative analysts.

It is NOT a legal determination system.

The final system must preserve this exact positioning:

"this is a decision-support lead list, not a legal determination."

This wording must not be casually changed.

---

# 3. SOURCE OF TRUTH

Read these files before making significant architectural decisions:

1. `PRD.md`
2. `CLAUDE.md`
3. Official project scope document if present in the repository.

Priority:

Official Scope
    >
PRD
    >
CLAUDE.md
    >
Existing implementation
    >
Claude's assumptions

If the scope and PRD conflict, STOP and flag the conflict.

Do not silently choose an interpretation.

If a requirement is unclear, explicitly identify the ambiguity.

Do not invent functionality.

---

# 4. MVP / FEATURE TIER RULE

The official project scope has three feature tiers:

[MVP]
Required for the working end-to-end demo.

[WORTH ADDING]
Important differentiation/depth after MVP works.

[STRETCH]
Optional and should be cut first under time pressure.

STRICT RULE:

If you are unsure whether a feature belongs in MVP:

Treat it as STRETCH until explicitly approved.

Do not spend MVP development time on STRETCH functionality.

The end-to-end MVP is more important than feature count.

---

# 5. OUR OWNERSHIP BOUNDARY

## WE OWN

### Stage B

- source-type triage
- platform proximity
- pipeline proximity
- source hypothesis
- evidence generation
- routing decision
- stationary-source handling

### Backend

- FastAPI
- Pydantic contracts
- orchestration
- adapters
- case repository
- mock providers
- API layer
- error handling
- logging
- integration testing

### Stage E

- report schema
- dossier generation
- evidence formatting
- limitations
- provenance
- disclaimer
- PDF export if implemented

### Frontend

- React
- TypeScript
- Mapbox
- wizard flow
- case selection
- investigation state
- map layers
- source hypothesis UI
- drift UI
- vessel UI
- final report UI

---

# 6. DO NOT IMPLEMENT OTHER TEAMMATES' INTERNAL WORK

Do NOT independently implement:

- U-Net/SAR segmentation
- OpenDrift/OpenOil physics
- AIS vessel scoring
- vessel trajectory scoring
- synthetic guilty-vessel generation

unless explicitly asked.

Instead create adapters/interfaces.

Examples:

DetectionProvider
DriftProvider
AttributionProvider

Then provide:

MockDetectionProvider
MockDriftProvider
MockAttributionProvider

Later:

RealDetectionProvider
RealDriftProvider
RealAttributionProvider

The frontend and reporting layer should not care whether
the underlying provider is real or mocked.

---

# 7. ARCHITECTURAL PRINCIPLE

The system should be:

MODULAR
EXPLAINABLE
TESTABLE
DEMO-READY
REPLACEABLE
CONTRACT-DRIVEN

Avoid tightly coupling:

Stage A → Stage B
Stage B → Stage C
Stage C → Stage D
Stage D → Stage E

through implementation details.

Use typed contracts.

---

# 8. CROSS-STAGE CONTRACTS ARE FROZEN

Integration contracts are extremely important.

The following must remain stable unless the team explicitly agrees to change them:

- coordinate system
- timestamp format
- spill polygon representation
- stage input/output schemas
- investigation aggregate structure

Before changing a contract:

1. Identify the affected stages.
2. Explain the breaking change.
3. Identify frontend impact.
4. Identify test impact.
5. Get explicit approval.

Never silently modify a shared schema.

---

# 9. GEO-SPATIAL CONTRACT

Canonical coordinate reference system:

WGS84 / EPSG:4326

API coordinate object:

{
  "lat": number,
  "lon": number
}

GeoJSON follows standard GeoJSON ordering:

[longitude, latitude]

This distinction is extremely important.

Never accidentally swap:

latitude
longitude

when converting to GeoJSON.

Use Turf.js / Shapely where appropriate instead of manually
implementing geospatial calculations.

---

# 10. TIME CONTRACT

Backend timestamps must use UTC.

Format:

ISO 8601

Example:

2026-08-29T12:30:00Z

Do not pass ambiguous local timestamps between stages.

Frontend may convert UTC into a display timezone.

Backend logic remains UTC.

---

# 11. STAGE B — SOURCE-TYPE TRIAGE

## Purpose

Stage B determines what type of source is plausible at the estimated spill origin.

It exists specifically to prevent the system from automatically blaming
a vessel when the actual source could be stationary.

Possible hypotheses:

- `likely-vessel`
- `likely-platform`
- `likely-pipeline`
- `possible-natural-seep`
- `insufficient-evidence`

Do not introduce arbitrary alternative labels.

---

# 12. STAGE B INPUT

Stage B primarily receives:

- estimated spill origin
- origin time window where relevant
- platform data
- pipeline data
- optional seep data
- configuration thresholds
- relevant upstream evidence

The origin comes from Stage C.

Stage B must not calculate the drift origin itself.

---

# 13. STAGE B PLATFORM CHECK

Determine whether the estimated origin is sufficiently close
to a known offshore platform.

Output should include:

- nearby/not nearby
- nearest platform
- distance in km
- platform coordinates
- supporting evidence

Use a configurable threshold.

Do NOT hardcode arbitrary values into business logic.

---

# 14. STAGE B PIPELINE CHECK

Determine whether the estimated origin is sufficiently close
to a known offshore pipeline route.

This is a point-to-line geospatial distance problem.

Output should include:

- nearby/not nearby
- nearest pipeline
- distance in km
- supporting evidence

Use Shapely/geospatial libraries.

Do not implement fragile manual coordinate geometry.

---

# 15. STAGE B DATA FALLBACK

Preferred sources:

- public oil/gas infrastructure datasets
- Global Energy Monitor
- OpenStreetMap

If public coverage is inadequate for the selected demo region:

Use a small, hand-verified static dataset.

The application must continue to work.

Do not allow external-data availability to break the demo.

The fallback must be clearly documented.

Do not fabricate infrastructure data.

---

# 16. STAGE B DECISION ENGINE

Stage B should be deterministic and explainable.

Do NOT introduce a black-box ML classifier.

Conceptual decision order:

1. Evaluate stationary infrastructure.
2. Compare competing evidence.
3. Determine the strongest source hypothesis.
4. Generate evidence.
5. Decide whether vessel attribution should execute.

The final decision must be explainable in human-readable language.

Example:

"Estimated origin is 1.8 km from a known offshore platform,
while the nearest mapped pipeline is 47.2 km away."

---

# 17. STAGE B ROUTING RULE

This is critical.

If:

`likely-platform`

DO NOT run Stage D.

If:

`likely-pipeline`

DO NOT run Stage D.

If:

`possible-natural-seep`

DO NOT run Stage D.

If:

`likely-vessel`

Stage D may execute.

If:

`insufficient-evidence`

Stage D may execute only as a clearly labelled low-confidence investigation.

Never force vessel attribution.

---

# 18. STAGE B EVIDENCE

Every triage result must contain evidence.

Bad:

{
  "hypothesis": "likely-platform"
}

Good:

{
  "hypothesis": "likely-platform",
  "evidence": [
    "Estimated origin is 1.8 km from platform P-17.",
    "Nearest mapped pipeline is 47.2 km away.",
    "Stationary infrastructure provides stronger source evidence."
  ]
}

The frontend must be able to display this evidence directly.

Do not make the frontend reconstruct reasoning from raw distances.

---

# 19. STAGE E — INVESTIGATOR'S DOSSIER

Stage E is a REPORTING LAYER.

Stage E does not perform new modelling.

Stage E consumes:

Stage A
+
Stage B
+
Stage C
+
Stage D when applicable

and produces a structured investigation report.

Never add scientific inference inside the reporting layer.

---

# 20. REPORT CONTENT

Minimum report sections:

## Case

- case ID
- region
- detection time
- investigation time

## Detection

- location
- polygon
- area
- perimeter
- elongation
- indicative detection confidence
- look-alike awareness

## Source Hypothesis

- hypothesis
- confidence/strength
- supporting evidence
- nearest platform
- nearest pipeline
- routing decision

## Drift

- estimated origin
- origin time window
- backward path
- forward forecast
- time to coastline
- time to sensitive zone if available

## Vessel Attribution

Only if applicable.

Include:

- vessel identifier
- vessel name if available
- ranking
- overall score
- proximity score
- trajectory score
- evidence

## Limitations

Explicitly state known limitations.

## Disclaimer

Every generated report must contain:

"this is a decision-support lead list, not a legal determination."

---

# 21. SYNTHETIC AIS DISCLOSURE

AIS used in the demo is synthetic.

Never imply it is live vessel traffic.

The UI and report must communicate that synthetic AIS is being used
for controlled validation.

Recommended wording:

"AIS tracks shown in this demonstration are synthetically generated
for controlled validation and do not represent live vessel traffic."

Do not remove this disclosure.

---

# 22. ATTRIBUTION LANGUAGE

Never write:

"Vessel X caused the spill."

Never write:

"Vessel X is guilty."

Never write:

"Vessel X is confirmed responsible."

Use:

"Vessel X is the highest-priority investigative lead."

or:

"Vessel X ranks highest under the current attribution criteria."

The system produces investigative leads, not legal conclusions.

---

# 23. DETECTION CONFIDENCE LANGUAGE

Stage A raw class probabilities are not automatically calibrated probabilities.

Never casually display:

"87% probability of oil spill"

as if this were a calibrated statistical probability.

Prefer:

"Indicative detection confidence"

If raw model probability is shown, clearly identify its nature.

---

# 24. STAGE D INTEGRATION

Stage D is owned by another team member.

The integration layer should only:

1. Determine whether Stage D should execute.
2. Pass the correct origin/time-window information.
3. Validate the response.
4. Normalize it into the frozen contract.
5. Pass the result to Stage E/frontend.

Do not duplicate Stage D scoring logic in the backend integration layer.

---

# 25. INVESTIGATION ORCHESTRATOR

Create one central orchestration service.

Conceptually:

load case

↓

get Stage A result

↓

get Stage C result

↓

run Stage B

↓

check routing

↓

if vessel:
    run Stage D

otherwise:
    mark attribution as skipped

↓

generate Stage E report

↓

return InvestigationCase

The frontend should primarily consume this aggregate.

---

# 26. INVESTIGATION STATE

Use a canonical aggregate:

InvestigationCase

Conceptually:

{
  case,
  detection,
  triage,
  drift,
  attribution,
  report,
  provenance
}

Optional fields must be explicitly nullable.

Do not make frontend components understand backend implementation details.

---

# 27. MOCK DATA IS REQUIRED

The application must work without the real upstream models.

Create deterministic mocks for:

- Stage A
- Stage C
- Stage D

Minimum demo cases:

### Case 1

Likely vessel.

Expected:

Stage D runs.

### Case 2

Likely platform.

Expected:

Stage D does NOT run.

### Case 3

Likely pipeline.

Expected:

Stage D does NOT run.

This demonstrates that Stage B is actually doing useful work.

---

# 28. MOCK DATA RULES

Mock data must be:

- deterministic
- internally consistent
- geographically coherent
- clearly labelled as mock/demo data

Do not generate random values on every API request.

A judge should see the same result every time.

---

# 29. BACKEND TECHNOLOGY

Preferred stack:

Python 3.11+

FastAPI

Pydantic

GeoPandas

Shapely

PyProj

Jinja2

ReportLab if PDF is implemented

Pytest

Ruff

Do not install additional libraries unless there is a concrete reason.

---

# 30. FRONTEND TECHNOLOGY

Preferred stack:

React

TypeScript

Vite

Mapbox GL JS

Tailwind CSS

Framer Motion

Lucide React

Axios

Turf.js

Recharts only if actually useful.

State management:

React state/hooks.

Do NOT introduce Redux.

Do NOT introduce Zustand.

The official scope explicitly calls for a React useState-based wizard and says Redux/Zustand is unnecessary.

---

# 31. FRONTEND DESIGN

The frontend is NOT a generic analytics dashboard.

It is a:

GUIDED INVESTIGATION NARRATIVE.

The user should progressively discover the evidence.

Core flow:

Landing
    ↓
Case Selection
    ↓
Detection
    ↓
Source Triage
    ↓
Origin / Drift
    ↓
Vessel Attribution (if applicable)
    ↓
Forecast
    ↓
Investigator's Dossier

Use a wizard-style experience.

Allow going backward.

Do not create unrestricted navigation between every stage.

---

# 32. MAPBOX IS CENTRAL

The map is the primary visual surface.

It should support:

- world view
- case region
- spill polygon
- spill centroid
- origin
- backward drift
- forward forecast
- platforms
- pipelines
- vessels

MVP vessel tracks are static points.

Do not build animated vessel tracks unless explicitly promoted to WORTH ADDING/STRETCH.

---

# 33. MAP LAYERS

Keep map layers modular.

Recommended:

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
platform-layer

pipeline-source
pipeline-layer

vessel-source
vessel-layer

Do not place every map feature into one massive component.

---

# 34. MAP INTERACTIONS

Clicking the spill:

show spill metrics.

Clicking origin:

show origin estimate and time window.

Clicking infrastructure:

show infrastructure type, ID/name and distance.

Clicking vessel:

show:

- vessel
- score
- rank
- proximity
- trajectory
- evidence

---

# 35. FRONTEND STATE

Use a central investigation state.

Conceptually:

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

Do not duplicate the same investigation data across components.

---

# 36. API CLIENT

All API calls must live in:

`services/api.ts`

Do not scatter Axios/fetch calls across React components.

Use typed functions such as:

getCases()

getCase()

runInvestigation()

getInvestigation()

runTriage()

getDrift()

getAttribution()

generateReport()

---

# 37. TYPESCRIPT TYPES

Frontend types must correspond to backend contracts.

Do not manually invent a different representation.

When backend contracts change:

update:

- Pydantic models
- API tests
- TypeScript types
- integration tests

Do not allow the frontend/backend schemas to silently drift.

---

# 38. ERROR HANDLING

Distinguish between:

REAL ERROR

and

VALID SYSTEM STATE.

Example:

Stage D skipped because Stage B identified a platform:

NOT AN ERROR.

Display:

"Vessel attribution was not run because the source triage identified
a likely stationary source."

Backend failure:

REAL ERROR.

Display appropriate recovery UI.

Never show raw Python stack traces to users.

---

# 39. LOADING STATES

Use meaningful investigation-stage messages.

Examples:

"Loading spill detection..."

"Checking stationary infrastructure..."

"Tracing probable origin..."

"Correlating vessel tracks..."

"Compiling investigation dossier..."

Do not fake numerical progress percentages unless the backend actually reports progress.

---

# 40. DATA PROVENANCE

Major outputs should identify their source.

Possible provenance:

- Stage A model
- Stage B rule engine
- Stage C OpenDrift/OpenOil
- Stage D synthetic AIS
- infrastructure dataset
- historical case data

The report should be able to display provenance.

---

# 41. EXTERNAL DATA

Never make the MVP dependent on unreliable live external APIs.

For demo-critical data:

prefer:

verified local datasets
or
static GeoJSON/JSON

External data should be downloaded/cached when practical.

The demo must continue to work if an external service becomes unavailable.

---

# 42. DATABASE

Do not introduce PostgreSQL/PostGIS unless there is a demonstrated requirement.

For MVP, curated JSON/GeoJSON data is acceptable.

Do not introduce:

Kubernetes
microservices
Redis
message queues

unless explicitly justified.

Hackathon reliability is more important than infrastructure complexity.

---

# 43. CONFIGURATION

Never hardcode business thresholds.

Use configuration/environment variables where appropriate.

Examples:

TRIAGE_PLATFORM_RADIUS_KM

TRIAGE_PIPELINE_RADIUS_KM

MAPBOX_TOKEN

API_BASE_URL

API_TIMEOUT_SECONDS

Do not commit secrets.

Provide:

`.env.example`

---

# 44. TESTING

Every business-critical Stage B rule requires tests.

Minimum:

### Platform positive

Origin near platform.

Expected:

platform detected.

### Platform negative

Origin far from platform.

Expected:

platform not detected.

### Pipeline positive

Origin near pipeline.

Expected:

pipeline detected.

### Vessel routing

No strong stationary source.

Expected:

likely-vessel.

Stage D allowed.

### Platform routing

Expected:

likely-platform.

Stage D blocked.

### Pipeline routing

Expected:

likely-pipeline.

Stage D blocked.

### Insufficient evidence

Expected:

insufficient-evidence.

---

# 45. INTEGRATION TESTS

At minimum test:

## Vessel scenario

Stage A
→ Stage C
→ Stage B
→ Stage D
→ Stage E

Must produce complete investigation.

## Platform scenario

Stage A
→ Stage C
→ Stage B
→ Stage E

Stage D must not execute.

## Pipeline scenario

Stage A
→ Stage C
→ Stage B
→ Stage E

Stage D must not execute.

---

# 46. CONTRACT TESTS

Every upstream response must be validated.

If Stage A produces an invalid payload:

FAIL CLEARLY.

Example:

"Stage A response failed DetectionResult schema validation."

Never silently repair structurally invalid data unless an explicit adapter rule exists.

---

# 47. CODE QUALITY

Backend:

Ruff
Pytest
Type hints

Frontend:

TypeScript strict mode
ESLint
Prettier

Avoid:

- giant functions
- giant React components
- duplicated business logic
- magic numbers
- hidden global state
- hardcoded secrets
- arbitrary assumptions

Prefer:

small services
small components
typed interfaces
pure functions for business rules
testable logic

---

# 48. GEO CODE QUALITY

Do not implement manual geographic calculations when established libraries exist.

Use:

Shapely
GeoPandas
PyProj
Turf.js

where appropriate.

Be careful with:

- degrees vs metres
- latitude vs longitude
- GeoJSON coordinate ordering
- geographic vs projected distance

---

# 49. SECURITY

Never:

- commit API keys
- expose Mapbox secrets unnecessarily
- execute arbitrary uploaded files
- trust arbitrary JSON without validation
- expose internal stack traces

Validate:

- API inputs
- file inputs if upload is eventually implemented
- GeoJSON
- stage responses

---

# 50. LOGGING

Backend logs should make investigations traceable.

Useful fields:

request_id
case_id
stage
start_time
end_time
success/failure

Never log secrets.

---

# 51. PERFORMANCE

Do not prematurely optimize.

For MVP:

simple FastAPI
+
curated data
+
deterministic providers
+
typed API

is preferred.

Do not introduce distributed infrastructure just because it sounds production-grade.

---

# 52. IMPLEMENTATION ORDER

Always build in this order unless explicitly instructed otherwise:

## Phase 1

Architecture + contracts.

## Phase 2

Stage B.

## Phase 3

Backend orchestration.

## Phase 4

Mock end-to-end pipeline.

## Phase 5

Frontend foundation.

## Phase 6

Frontend investigation flow.

## Phase 7

Stage E report.

## Phase 8

Real Stage A integration.

## Phase 9

Real Stage C integration.

## Phase 10

Real Stage D integration.

## Phase 11

Testing.

## Phase 12

Visual polish.

Do not polish a broken pipeline.

---

# 53. CLAUDE CODE WORKING STYLE

Do not attempt to build the entire project in one giant operation.

For every meaningful task:

1. Inspect the existing repository.
2. Identify relevant files.
3. Explain the intended change.
4. Make a small coherent change.
5. Run relevant tests.
6. Run type checks/linting.
7. Fix failures.
8. Review the diff.
9. Update documentation if necessary.

Then proceed.

---

# 54. BEFORE MODIFYING EXISTING CODE

First inspect:

- package.json
- pyproject.toml
- requirements files
- environment configuration
- existing routes
- existing components
- existing API services
- existing map implementation
- existing tests

Do not overwrite existing working architecture without understanding it.

---

# 55. DEPENDENCY RULE

Before installing a package:

Ask:

"Do we actually need this?"

Prefer existing dependencies.

Avoid installing multiple libraries that solve the same problem.

Do not install:

Redux
Zustand
multiple map libraries
multiple HTTP clients
multiple UI frameworks

unless explicitly required.

---

# 56. FILE ORGANIZATION

Keep backend and frontend clearly separated.

Recommended:

backend/
frontend/
data/
docs/

Backend:

backend/app/
    api/
    schemas/
    services/
    integrations/
    data/
    core/

Frontend:

frontend/src/
    pages/
    components/
    services/
    types/
    hooks/
    utils/

---

# 57. DOCUMENTATION

When implementing important architectural decisions, document:

- why the decision was made
- what contract is affected
- what assumptions exist
- what is MVP vs optional

Do not create unnecessary documentation for trivial code.

---

# 58. DEMO-FIRST ENGINEERING

The final system must survive a live SIH demonstration.

Therefore:

- demo data should be deterministic
- critical datasets should be local/cached
- external services should have fallbacks where practical
- loading states should be graceful
- errors should not destroy the application
- the primary demo path should avoid arbitrary SAR uploads

The official scope specifically recommends 2–3 curated, pre-verified cases for the live demo. :contentReference[oaicite:1]{index=1}

---

# 59. REAL HISTORICAL CASE

At least one curated case must be a real documented historical spill with:

- known location
- known timing

This case is needed for the Stage C evaluation.

Do not fabricate historical ground truth.

Source it from the project's approved sources such as:

- ITOPF
- NOAA ERMA

---

# 60. EVALUATION HONESTY

Never invent performance numbers.

If an evaluation metric has not been computed:

say:

"Not yet evaluated."

Do not estimate.

Do not turn a demo result into an accuracy claim.

---

# 61. STAGE D EVALUATION DISCLAIMER

The official scope states that Stage D's synthetic evaluation validates the mechanism against controlled ground truth,
but does NOT prove generalization to real-world AIS.

Do not hide this.

If presenting evaluation results, use honest language such as:

"Controlled synthetic validation"

rather than:

"Real-world AIS accuracy."

---

# 62. STAGE C EVALUATION DISCLAIMER

If the drift result is based on one historical case:

state:

n=1

Do not imply statistical significance.

---

# 63. KNOWN LIMITATIONS

Do not remove or hide these limitations:

1. Demo AIS is synthetic.
2. Stage A confidence is indicative/uncalibrated.
3. Public infrastructure datasets may have incomplete coverage.
4. MVP vessel attribution relies on proximity + trajectory.
5. AIS dark gaps can reduce attribution effectiveness.
6. Drift validation may be based on one historical case.
7. System output is an investigative lead, not a legal conclusion.

The official scope explicitly identifies these limitations. :contentReference[oaicite:2]{index=2}

---

# 64. MVP BOUNDARY

MVP must prioritize:

- Stage B
- backend
- integration
- curated cases
- Mapbox
- guided investigation
- Stage E
- complete end-to-end demo

Do not sacrifice the end-to-end pipeline to build optional sophistication.

---

# 65. WORTH ADDING

Only after MVP works:

- richer evidence breakdown
- dark-gap attribution integration
- behavioral evidence
- AIS integrity score
- confidence tiers
- polished PDF
- forecast/attribution toggle
- better vessel visualization

The scope identifies these as later-tier improvements. :contentReference[oaicite:3]{index=3}

---

# 66. STRETCH

Only attempt after the core project is stable:

- natural seep detection
- repeated-origin analysis
- arbitrary SAR upload
- animated vessel tracks
- time slider
- ensemble uncertainty visualization
- deck.gl/kepler.gl

Never let these delay MVP.

---

# 67. FRONTEND UX RULE

The user should understand the investigation without seeing source code.

The UI must answer:

1. What was detected?
2. Where is it?
3. Is it likely a real spill?
4. What could have caused it?
5. Why?
6. Where did it probably originate?
7. Which vessels are investigative leads?
8. Why were they ranked?
9. Where is the spill going?
10. What are the limitations?

---

# 68. VISUAL DESIGN RULES

Target:

professional maritime intelligence tool.

Characteristics:

- map-first
- clean typography
- restrained colors
- strong information hierarchy
- subtle animation
- professional cards/panels
- evidence-oriented presentation

Avoid:

- generic Bootstrap appearance
- excessive gradients
- excessive neon
- pointless animations
- card overload
- giant empty spaces
- decorative UI that does not support investigation

Animation should communicate progression or spatial reasoning.

---

# 69. REPORTING RULE

Stage E should compile.

It should not infer.

If information is missing:

display:

"Not available"

or

"Not provided by upstream stage."

Do NOT fabricate a value.

---

# 70. MISSING DATA RULE

Never silently convert missing data into zero.

Examples:

Missing pipeline distance ≠ 0 km.

Missing vessel score ≠ 0.

Missing forecast ≠ no forecast.

Missing confidence ≠ 0%.

Use:

null

and explain it where appropriate.

---

# 71. NO FABRICATION RULE

Never fabricate:

- vessel identities
- historical incidents
- infrastructure
- model accuracy
- AIS evidence
- drift accuracy
- scientific measurements
- sources
- ground truth

Demo data may be synthetic only when explicitly labelled as synthetic/mock.

---

# 72. BREAKING CHANGE RULE

If you discover that a frozen interface is insufficient:

DO NOT silently modify it.

Instead report:

PROBLEM

CURRENT CONTRACT

WHY IT IS INSUFFICIENT

PROPOSED CHANGE

AFFECTED STAGES

MIGRATION PLAN

Then wait for approval.

---

# 73. WHEN TEAMMATE CODE IS UNAVAILABLE

Use an adapter.

Do not block frontend/backend development waiting for another stage.

Example:

if Stage C is unavailable:

MockDriftProvider

should produce a deterministic DriftResult.

Later replace:

MockDriftProvider

with:

RealDriftProvider

without changing the frontend.

---

# 74. GIT RULES

Use feature branches.

Examples:

feature/stage-b-triage
feature/backend-contracts
feature/frontend-map
feature/reporting
feature/integration-stage-a
feature/integration-stage-c
feature/integration-stage-d

Use small, meaningful commits.

Examples:

feat: add Stage B triage contracts

feat: implement platform proximity check

feat: add pipeline proximity service

feat: add investigation orchestrator

feat: add Mapbox spill layer

fix: correct GeoJSON coordinate ordering

Do not create giant commits containing unrelated changes.

---

# 75. BEFORE SAYING "DONE"

Claude Code must verify:

[ ] Application builds.

[ ] Backend starts.

[ ] Frontend starts.

[ ] Tests pass.

[ ] Type checking passes.

[ ] Linting passes where configured.

[ ] API contracts validate.

[ ] Mock investigation works.

[ ] Vessel case works.

[ ] Platform case skips Stage D.

[ ] Pipeline case skips Stage D.

[ ] Report renders.

[ ] Disclaimer exists.

[ ] Synthetic AIS disclosure exists.

[ ] No secrets are committed.

[ ] No teammate stage was accidentally rewritten.

---

# 76. FIRST TASK AFTER READING THIS FILE

When this repository is first opened:

DO NOT immediately implement the project.

First inspect the repository.

Then produce:

1. Current repository structure.
2. Existing frontend stack.
3. Existing backend stack.
4. Existing dependencies.
5. Existing API routes.
6. Existing components.
7. Existing map implementation.
8. Existing data.
9. Missing functionality.
10. Contract risks.
11. Recommended implementation sequence.

Then STOP.

Wait for the developer to approve the plan.

---

# 77. FIRST IMPLEMENTATION MILESTONE

After approval, implement only:

- backend structure
- Pydantic contracts
- Stage A mock
- Stage C mock
- Stage D mock
- infrastructure data/mocks
- Stage B engine
- Stage B tests
- investigation orchestrator
- basic FastAPI endpoints

The milestone is complete when:

A complete mock investigation can run:

Stage A
→ Stage C
→ Stage B
→ conditional Stage D
→ Stage E

---

# 78. SECOND IMPLEMENTATION MILESTONE

Build frontend foundation:

- React
- TypeScript
- Mapbox
- application layout
- sidebar
- wizard state
- case selection
- API client
- base map

Connect to mock backend.

---

# 79. THIRD IMPLEMENTATION MILESTONE

Build the full investigation experience:

Detection
→ Triage
→ Origin
→ Attribution
→ Forecast
→ Report

Do not wait for real Stage A/C/D implementations.

Use mocks.

---

# 80. FOURTH IMPLEMENTATION MILESTONE

Integrate real teammate modules.

Order:

Stage A
→ verify contract
→ test

Stage C
→ verify contract
→ test

Stage D
→ verify contract
→ test

After each integration:

run unit tests
run contract tests
run end-to-end investigation
verify frontend

---

# 81. FINAL PRODUCT PRINCIPLE

The project's differentiation is NOT simply:

"we used AI to detect oil."

The value is:

Detection
+
Source-type reasoning
+
Drift reconstruction
+
Conditional vessel attribution
+
Explainability
+
Uncertainty awareness
+
Evidence-backed reporting
+
Guided investigation UI

The system should make the investigation understandable to a judge,
not merely make the underlying models technically impressive.

---

# 82. FINAL RULE

When forced to choose between:

MORE FEATURES

and

A RELIABLE END-TO-END DEMO

ALWAYS CHOOSE:

A RELIABLE END-TO-END DEMO.

When forced to choose between:

A COMPLEX BLACK BOX

and

A SIMPLE EXPLAINABLE IMPLEMENTATION

ALWAYS CHOOSE:

THE SIMPLE EXPLAINABLE IMPLEMENTATION.

When forced to choose between:

AN ASSUMPTION

and

ASKING/FLAGGING AN AMBIGUITY

ALWAYS:

FLAG THE AMBIGUITY.

When forced to choose between:

ATTRIBUTION

and

AVOIDING A FALSE ACCUSATION

ALWAYS:

AVOID THE FALSE ACCUSATION.

END OF CLAUDE.md