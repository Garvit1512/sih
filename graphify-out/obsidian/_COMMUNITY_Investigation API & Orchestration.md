---
type: community
cohesion: 0.06
members: 58
---

# Investigation API & Orchestration

**Cohesion:** 0.06 - loosely connected
**Members:** 58 nodes

## Members
- [[dot-_validate_utc()]] - code - backend/app/schemas/common.py
- [[dot-_validate_utc()_1]] - code - backend/app/schemas/detection.py
- [[dot-get_result()_5]] - code - backend/app/integrations/base.py
- [[BaseModel_3]] - code
- [[BaseModel_4]] - code
- [[BaseModel_5]] - code
- [[BaseModel_6]] - code
- [[BaseModel_7]] - code
- [[CaseSummary]] - code - backend/app/schemas/report.py
- [[Contract tests GeoJSON coordinate ordering, UTC enforcement, and schema…]] - rationale - backend/tests/test_contracts.py
- [[DetectRequest]] - code - backend/app/api/detection.py
- [[DetectionConfidence]] - code - backend/app/schemas/detection.py
- [[DetectionResult]] - code - backend/app/schemas/detection.py
- [[DetectionResult (Stage A)]] - concept - docs/contracts.md
- [[ForecastResult]] - code - backend/app/schemas/drift.py
- [[Geotime contract primitives shared across every frozen cross-stage schema.…]] - rationale - backend/app/schemas/common.py
- [[GeoJSONLineString]] - code - backend/app/schemas/common.py
- [[GeoJSONPoint]] - code - backend/app/schemas/common.py
- [[GeoJSONPolygon]] - code - backend/app/schemas/common.py
- [[HindcastResult]] - code - backend/app/schemas/drift.py
- [[InvestigationReport]] - code - backend/app/schemas/report.py
- [[InvestigationReport (Stage E)]] - concept - docs/contracts.md
- [[POST apidetect (PRD §29). MVP scope serves the case's mockreal Stage A…]] - rationale - backend/app/api/detection.py
- [[PRD InvestigationReport Data Model]] - concept - prd.md
- [[PRD Stage A Contract (DetectionResult)]] - concept - prd.md
- [[Reject naive or non-UTC timestamps at the API boundary (PRD §10).]] - rationale - backend/app/schemas/common.py
- [[SpillGeometry]] - code - backend/app/schemas/detection.py
- [[Stage A contract — DetectionResult. Frozen per PRD §11. Stage A internals (SAR…]] - rationale - backend/app/schemas/detection.py
- [[Stage C contract — DriftResult. Frozen per PRD §12. Stage C internals…]] - rationale - backend/app/schemas/drift.py
- [[Stage E -- Investigator's Dossier (PRD §23-§26). Reporting layer only. Never…]] - rationale - backend/app/services/report_service.py
- [[Stage E contract — InvestigationReport. Stage E is a reporting layer only (PRD…]] - rationale - backend/app/schemas/report.py
- [[Time Contract UTC-Enforced (§1.2)]] - concept - docs/contracts.md
- [[TimeWindow]] - code - backend/app/schemas/common.py
- [[apidetection.py]] - code - backend/app/api/detection.py
- [[common.py]] - code - backend/app/schemas/common.py
- [[datetime]] - code
- [[datetime_1]] - code
- [[detect()]] - code - backend/app/api/detection.py
- [[field_validator]] - code
- [[field_validator_1]] - code
- [[generate()]] - code - backend/app/services/report_service.py
- [[parametrize]] - code
- [[post_2]] - code
- [[report_service.py]] - code - backend/app/services/report_service.py
- [[require_utc()]] - code - backend/app/schemas/common.py
- [[schemasdetection.py]] - code - backend/app/schemas/detection.py
- [[schemasdrift.py]] - code - backend/app/schemas/drift.py
- [[schemasreport.py]] - code - backend/app/schemas/report.py
- [[test_contracts.py]] - code - backend/tests/test_contracts.py
- [[test_contracts.py Enforcement Suite (12 tests)]] - document - docs/contracts.md
- [[test_coordinate_to_geojson_uses_lon_lat_order()]] - code - backend/tests/test_contracts.py
- [[test_invalid_detection_payload_fails_validation()]] - code - backend/tests/test_contracts.py
- [[test_mock_attribution_fixture_validates()]] - code - backend/tests/test_contracts.py
- [[test_mock_detection_fixture_validates()]] - code - backend/tests/test_contracts.py
- [[test_mock_drift_fixture_validates()]] - code - backend/tests/test_contracts.py
- [[test_time_window_accepts_utc()]] - code - backend/tests/test_contracts.py
- [[test_time_window_rejects_naive_datetime()]] - code - backend/tests/test_contracts.py
- [[test_time_window_rejects_non_utc_offset()]] - code - backend/tests/test_contracts.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Investigation_API__Orchestration
SORT file.name ASC
```

## Connections to other communities
- 27 edges to [[_COMMUNITY_Stage B Triage & Infrastructure]]
- 17 edges to [[_COMMUNITY_Vessel Attribution & Synthetic AIS]]
- 12 edges to [[_COMMUNITY_Investigation & Report Tests]]
- 4 edges to [[_COMMUNITY_Drift Forecast & Open Items]]

## Top bridge nodes
- [[schemasreport.py]] - degree 16, connects to 4 communities
- [[schemasdetection.py]] - degree 16, connects to 3 communities
- [[report_service.py]] - degree 16, connects to 3 communities
- [[schemasdrift.py]] - degree 15, connects to 3 communities
- [[generate()]] - degree 9, connects to 3 communities