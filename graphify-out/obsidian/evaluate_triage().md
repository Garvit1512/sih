---
source_file: "backend/app/services/triage_service.py"
type: "code"
community: "Vessel Attribution & Synthetic AIS"
location: "L39"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Vessel_Attribution__Synthetic_AIS
---

# evaluate_triage()

## Connections
- [[Coordinate]] - `uses` [INFERRED]
- [[InfrastructureDataset]] - `uses` [INFERRED]
- [[InfrastructureEvidence]] - `calls` [EXTRACTED]
- [[Settings]] - `uses` [INFERRED]
- [[TriageConfidence]] - `calls` [EXTRACTED]
- [[TriageEvidence]] - `calls` [EXTRACTED]
- [[TriageResult]] - `calls` [EXTRACTED]
- [[TriageResult (Stage B)]] - `references` [EXTRACTED]
- [[TriageRouting]] - `calls` [EXTRACTED]
- [[_build_narrative()]] - `calls` [EXTRACTED]
- [[attribute()]] - `calls` [EXTRACTED]
- [[nearest_pipeline()]] - `calls` [EXTRACTED]
- [[nearest_platform()]] - `calls` [EXTRACTED]
- [[run_investigation()_1]] - `calls` [EXTRACTED]
- [[test_insufficient_evidence_when_no_source_at_all()]] - `calls` [EXTRACTED]
- [[test_pipeline_positive_within_threshold()]] - `calls` [EXTRACTED]
- [[test_pipeline_routing_blocks_stage_d()]] - `calls` [EXTRACTED]
- [[test_platform_negative_outside_threshold()]] - `calls` [EXTRACTED]
- [[test_platform_positive_within_threshold()]] - `calls` [EXTRACTED]
- [[test_platform_routing_blocks_stage_d()]] - `calls` [EXTRACTED]
- [[test_platform_wins_when_both_nearby_but_platform_is_closer()]] - `calls` [EXTRACTED]
- [[test_triage.py]] - `imports` [EXTRACTED]
- [[test_vessel_routing_when_no_stationary_source()]] - `calls` [EXTRACTED]
- [[triage()]] - `calls` [EXTRACTED]
- [[triage_service.py]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Vessel_Attribution__Synthetic_AIS