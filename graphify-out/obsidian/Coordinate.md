---
source_file: "backend/app/schemas/common.py"
type: "code"
community: "Vessel Attribution & Synthetic AIS"
location: "L17"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Vessel_Attribution__Synthetic_AIS
---

# Coordinate

## Connections
- [[dot-to_geojson_point()]] - `method` [EXTRACTED]
- [[BaseModel_4]] - `inherits` [EXTRACTED]
- [[Coordinates and Axis Order (§1.1)]] - `references` [EXTRACTED]
- [[HindcastResult]] - `uses` [INFERRED]
- [[InfrastructureEvidence]] - `uses` [INFERRED]
- [[NearestFeature]] - `uses` [INFERRED]
- [[PlatformFeature]] - `uses` [INFERRED]
- [[SpillGeometry]] - `uses` [INFERRED]
- [[_geodesic_distance_km()]] - `uses` [INFERRED]
- [[common.py]] - `contains` [EXTRACTED]
- [[evaluate_triage()]] - `uses` [INFERRED]
- [[infrastructure.py]] - `imports` [EXTRACTED]
- [[load_infrastructure()]] - `calls` [EXTRACTED]
- [[nearest_pipeline()]] - `uses` [INFERRED]
- [[nearest_platform()]] - `uses` [INFERRED]
- [[schemasdetection.py]] - `imports` [EXTRACTED]
- [[schemasdrift.py]] - `imports` [EXTRACTED]
- [[schemastriage.py]] - `imports` [EXTRACTED]
- [[test_contracts.py]] - `imports` [EXTRACTED]
- [[test_coordinate_to_geojson_uses_lon_lat_order()]] - `calls` [EXTRACTED]
- [[test_insufficient_evidence_when_no_source_at_all()]] - `calls` [EXTRACTED]
- [[test_pipeline_positive_within_threshold()]] - `calls` [EXTRACTED]
- [[test_pipeline_routing_blocks_stage_d()]] - `calls` [EXTRACTED]
- [[test_platform_negative_outside_threshold()]] - `calls` [EXTRACTED]
- [[test_platform_positive_within_threshold()]] - `calls` [EXTRACTED]
- [[test_platform_routing_blocks_stage_d()]] - `calls` [EXTRACTED]
- [[test_platform_wins_when_both_nearby_but_platform_is_closer()]] - `calls` [EXTRACTED]
- [[test_triage.py]] - `imports` [EXTRACTED]
- [[test_vessel_routing_when_no_stationary_source()]] - `calls` [EXTRACTED]
- [[triage_service.py]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Vessel_Attribution__Synthetic_AIS