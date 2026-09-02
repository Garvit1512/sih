---
type: community
cohesion: 0.06
members: 66
---

# Stage B Triage & Infrastructure

**Cohesion:** 0.06 - loosely connected
**Members:** 66 nodes

## Members
- [[dot-get_result()]] - code - backend/app/integrations/base.py
- [[dot-get_result()_1]] - code - backend/app/integrations/base.py
- [[dot-get_result()_2]] - code - backend/app/integrations/mock/mock_attribution.py
- [[dot-get_result()_3]] - code - backend/app/integrations/mock/mock_detection.py
- [[dot-get_result()_4]] - code - backend/app/integrations/mock/mock_drift.py
- [[Adapter interfaces for Stages ACD (PRD §67§68). The orchestrator, Stage B,…]] - rationale - backend/app/integrations/base.py
- [[AttributeRequest]] - code - backend/app/api/attribution.py
- [[AttributionProvider]] - code - backend/app/integrations/base.py
- [[AttributionResult]] - code - backend/app/schemas/attribution.py
- [[AttributionResult (Stage D)]] - concept - docs/contracts.md
- [[BaseModel]] - code
- [[BaseModel_1]] - code
- [[BaseModel_2]] - code
- [[CaseNotFoundError]] - code - backend/app/core/errors.py
- [[Central filesystem paths for the curated caseinfrastructure datasets. `data`…]] - rationale - backend/app/core/paths.py
- [[DataDisclosure]] - code - backend/app/schemas/attribution.py
- [[DetectionProvider]] - code - backend/app/integrations/base.py
- [[Deterministic Stage A mock (PRD §31). Reads a hand-authored, fixed…]] - rationale - backend/app/integrations/mock/mock_detection.py
- [[Deterministic Stage C mock (PRD §31). See mock_detection.py for the pattern…]] - rationale - backend/app/integrations/mock/mock_drift.py
- [[Deterministic Stage D mock (PRD §31). See mock_detection.py for the pattern…]] - rationale - backend/app/integrations/mock/mock_attribution.py
- [[DriftProvider]] - code - backend/app/integrations/base.py
- [[DriftRequest]] - code - backend/app/api/drift.py
- [[DriftResult]] - code - backend/app/schemas/drift.py
- [[DriftResult (Stage C)]] - concept - docs/contracts.md
- [[Investigation orchestrator (PRD §30). load case - Stage A - Stage C - Stage…]] - rationale - backend/app/services/investigation_service.py
- [[MockAttributionProvider]] - code - backend/app/integrations/mock/mock_attribution.py
- [[MockDetectionProvider]] - code - backend/app/integrations/mock/mock_detection.py
- [[MockDriftProvider]] - code - backend/app/integrations/mock/mock_drift.py
- [[Not Yet Frozen — Open Items (§10, 11 items)]] - document - docs/contracts.md
- [[POST apiattribute (PRD §29). Runs Stage D only if Stage B routing allows it.]] - rationale - backend/app/api/attribution.py
- [[POST apidrift (PRD §29) -- Stage C integration endpoint, mock-backed for MVP.]] - rationale - backend/app/api/drift.py
- [[PRD Configuration Requirements]] - rationale - prd.md
- [[PRD Stage C Contract (DriftResult)]] - concept - prd.md
- [[PRD Stage D Contract (AttributionResult)]] - concept - prd.md
- [[Protocol]] - code
- [[Stage A provider selection (PRD §67§68). Swaps mock - real via config, with…]] - rationale - backend/app/integrations/stage_a.py
- [[Stage C provider selection (PRD §67§68). Swaps mock - real via config, with…]] - rationale - backend/app/integrations/stage_c.py
- [[Stage D contract — AttributionResult. Frozen per PRD §13. Stage D internals…]] - rationale - backend/app/schemas/attribution.py
- [[Stage D provider selection (PRD §67§68). Swaps mock - real via config, with…]] - rationale - backend/app/integrations/stage_d.py
- [[Triage Radius Thresholds (Placeholder Values)]] - rationale - data/README.md
- [[Typed application configuration (PRD §57§58). Thresholds and stage-provider…]] - rationale - backend/app/core/config.py
- [[VesselCandidate]] - code - backend/app/schemas/attribution.py
- [[VesselFeatures]] - code - backend/app/schemas/attribution.py
- [[apiattribution.py]] - code - backend/app/api/attribution.py
- [[apidrift.py]] - code - backend/app/api/drift.py
- [[attribute()]] - code - backend/app/api/attribution.py
- [[base.py]] - code - backend/app/integrations/base.py
- [[config.py]] - code - backend/app/core/config.py
- [[docsdecisions.md (Referenced but Missing)]] - document - docs/contracts.md
- [[drift()]] - code - backend/app/api/drift.py
- [[get_attribution_provider()]] - code - backend/app/integrations/stage_d.py
- [[get_detection_provider()]] - code - backend/app/integrations/stage_a.py
- [[get_drift_provider()]] - code - backend/app/integrations/stage_c.py
- [[investigation_service.py]] - code - backend/app/services/investigation_service.py
- [[mock_attribution.py]] - code - backend/app/integrations/mock/mock_attribution.py
- [[mock_detection.py]] - code - backend/app/integrations/mock/mock_detection.py
- [[mock_drift.py]] - code - backend/app/integrations/mock/mock_drift.py
- [[paths.py]] - code - backend/app/core/paths.py
- [[post]] - code
- [[post_1]] - code
- [[repositories__init__.py]] - code - backend/app/data/repositories/__init__.py
- [[schemasattribution.py]] - code - backend/app/schemas/attribution.py
- [[services__init__.py]] - code - backend/app/services/__init__.py
- [[stage_a.py]] - code - backend/app/integrations/stage_a.py
- [[stage_c.py]] - code - backend/app/integrations/stage_c.py
- [[stage_d.py]] - code - backend/app/integrations/stage_d.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Stage_B_Triage__Infrastructure
SORT file.name ASC
```

## Connections to other communities
- 27 edges to [[_COMMUNITY_Investigation API & Orchestration]]
- 24 edges to [[_COMMUNITY_Investigation & Report Tests]]
- 18 edges to [[_COMMUNITY_Vessel Attribution & Synthetic AIS]]
- 10 edges to [[_COMMUNITY_Drift Forecast & Open Items]]
- 1 edge to [[_COMMUNITY_Stage ACD Provider Contracts]]

## Top bridge nodes
- [[investigation_service.py]] - degree 33, connects to 4 communities
- [[services__init__.py]] - degree 6, connects to 3 communities
- [[apiattribution.py]] - degree 16, connects to 2 communities
- [[AttributionResult]] - degree 16, connects to 2 communities
- [[DriftResult]] - degree 14, connects to 2 communities