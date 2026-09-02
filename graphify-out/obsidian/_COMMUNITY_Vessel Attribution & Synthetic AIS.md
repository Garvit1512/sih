---
type: community
cohesion: 0.11
members: 49
---

# Vessel Attribution & Synthetic AIS

**Cohesion:** 0.11 - loosely connected
**Members:** 49 nodes

## Members
- [[dot-to_geojson_point()]] - code - backend/app/schemas/common.py
- [[BaseModel_8]] - code
- [[BaseModel_9]] - code
- [[BaseSettings]] - code
- [[Coordinate]] - code - backend/app/schemas/common.py
- [[Coordinates and Axis Order (§1.1)]] - concept - docs/contracts.md
- [[InfrastructureDataset]] - code - backend/app/data/infrastructure.py
- [[InfrastructureEvidence]] - code - backend/app/schemas/triage.py
- [[Loads and queries the Stage B infrastructure dataset (platforms + pipelines).…]] - rationale - backend/app/data/infrastructure.py
- [[NearestFeature]] - code - backend/app/data/infrastructure.py
- [[POST apitriage (PRD §29). Simplification accepts `{case_id}` and internally…]] - rationale - backend/app/api/triage.py
- [[Path]] - code
- [[PipelineFeature]] - code - backend/app/data/infrastructure.py
- [[PlatformFeature]] - code - backend/app/data/infrastructure.py
- [[Raw nearest-feature lookup. Threshold comparison (`nearby`) is Stage B business…]] - rationale - backend/app/data/infrastructure.py
- [[Settings]] - code - backend/app/core/config.py
- [[Stage B contract — TriageResult (source-type triage). Frozen per PRD §18-§22.…]] - rationale - backend/app/schemas/triage.py
- [[Stage B unit tests (PRD §49).]] - rationale - backend/tests/test_triage.py
- [[Stage B — Source-Type Triage engine (PRD §14-§22). Deterministic, explainable,…]] - rationale - backend/app/services/triage_service.py
- [[StrEnum]] - code
- [[TriageConfidence]] - code - backend/app/schemas/triage.py
- [[TriageEvidence]] - code - backend/app/schemas/triage.py
- [[TriageHypothesis]] - code - backend/app/schemas/triage.py
- [[TriageRequest]] - code - backend/app/api/triage.py
- [[TriageResult]] - code - backend/app/schemas/triage.py
- [[TriageResult (Stage B)]] - concept - docs/contracts.md
- [[TriageRouting]] - code - backend/app/schemas/triage.py
- [[_build_narrative()]] - code - backend/app/services/triage_service.py
- [[_geodesic_distance_km()]] - code - backend/app/data/infrastructure.py
- [[_read_geojson_features()]] - code - backend/app/data/infrastructure.py
- [[apitriage.py]] - code - backend/app/api/triage.py
- [[evaluate_triage()]] - code - backend/app/services/triage_service.py
- [[infrastructure.py]] - code - backend/app/data/infrastructure.py
- [[load_infrastructure()]] - code - backend/app/data/infrastructure.py
- [[nearest_pipeline()]] - code - backend/app/data/infrastructure.py
- [[nearest_platform()]] - code - backend/app/data/infrastructure.py
- [[post_3]] - code
- [[schemastriage.py]] - code - backend/app/schemas/triage.py
- [[test_insufficient_evidence_when_no_source_at_all()]] - code - backend/tests/test_triage.py
- [[test_pipeline_positive_within_threshold()]] - code - backend/tests/test_triage.py
- [[test_pipeline_routing_blocks_stage_d()]] - code - backend/tests/test_triage.py
- [[test_platform_negative_outside_threshold()]] - code - backend/tests/test_triage.py
- [[test_platform_positive_within_threshold()]] - code - backend/tests/test_triage.py
- [[test_platform_routing_blocks_stage_d()]] - code - backend/tests/test_triage.py
- [[test_platform_wins_when_both_nearby_but_platform_is_closer()]] - code - backend/tests/test_triage.py
- [[test_triage.py]] - code - backend/tests/test_triage.py
- [[test_vessel_routing_when_no_stationary_source()]] - code - backend/tests/test_triage.py
- [[triage()]] - code - backend/app/api/triage.py
- [[triage_service.py]] - code - backend/app/services/triage_service.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Vessel_Attribution__Synthetic_AIS
SORT file.name ASC
```

## Connections to other communities
- 18 edges to [[_COMMUNITY_Stage B Triage & Infrastructure]]
- 17 edges to [[_COMMUNITY_Investigation API & Orchestration]]
- 7 edges to [[_COMMUNITY_Investigation & Report Tests]]
- 1 edge to [[_COMMUNITY_Drift Forecast & Open Items]]

## Top bridge nodes
- [[evaluate_triage()]] - degree 25, connects to 2 communities
- [[triage_service.py]] - degree 23, connects to 2 communities
- [[test_triage.py]] - degree 21, connects to 2 communities
- [[infrastructure.py]] - degree 17, connects to 2 communities
- [[schemastriage.py]] - degree 16, connects to 2 communities