# Graph Report - sih  (2026-09-01)

## Corpus Check
- 73 files · ~85,461 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 538 nodes · 970 edges · 129 communities (10 shown, 112 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.89)
- Token cost: 0 input · 159,456 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128

## God Nodes (most connected - your core abstractions)
1. `Coordinate` - 30 edges
2. `run_investigation()` - 26 edges
3. `evaluate_triage()` - 25 edges
4. `graphify Skill` - 21 edges
5. `Stage 1 — Interface Contract Freeze` - 20 edges
6. `Stage 14 — Backward Hindcast & Origin Estimate` - 20 edges
7. `Stage 23 — Source Hypothesis Labelling & the Routing Gate` - 19 edges
8. `AttributionResult` - 16 edges
9. `DetectionResult` - 15 edges
10. `Stage 40 — Dossier Assembly` - 15 edges

## Surprising Connections (you probably didn't know these)
- `AttributionResult (Stage D)` --references--> `AttributionResult`  [EXTRACTED]
  docs/contracts.md → backend/app/schemas/attribution.py
- `Coordinates and Axis Order (§1.1)` --references--> `Coordinate`  [EXTRACTED]
  docs/contracts.md → backend/app/schemas/common.py
- `Time Contract: UTC-Enforced (§1.2)` --references--> `TimeWindow`  [EXTRACTED]
  docs/contracts.md → backend/app/schemas/common.py
- `DetectionResult (Stage A)` --references--> `DetectionResult`  [EXTRACTED]
  docs/contracts.md → backend/app/schemas/detection.py
- `DriftResult (Stage C)` --references--> `DriftResult`  [EXTRACTED]
  docs/contracts.md → backend/app/schemas/drift.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **The Four System Differentiators** — docs_staged_build_reference_uncertainty_awareness, docs_staged_build_reference_explainable_attribution, docs_staged_build_reference_multi_hypothesis_triage, docs_staged_build_reference_narrative_ui [EXTRACTED 1.00]
- **Frozen Cross-Stage Contract Objects** — docs_contracts_detectionresult, docs_contracts_driftresult, docs_contracts_triageresult, docs_contracts_attributionresult, docs_contracts_investigationreport, docs_contracts_investigationcase [EXTRACTED 1.00]
- **Graphify Build Pipeline (Step 0-Step 9)** — _claude_skills_graphify_skill_step0_github_clone, _claude_skills_graphify_skill_step1_install, _claude_skills_graphify_skill_step2_detect, _claude_skills_graphify_skill_step3_extract, _claude_skills_graphify_skill_step4_build, _claude_skills_graphify_skill_step5_label, _claude_skills_graphify_skill_step6_export, _claude_skills_graphify_skill_step9_manifest [EXTRACTED 1.00]
- **SIH Investigation Orchestration Flow** — claude_investigation_orchestrator, claude_stage_a_sar_detection, claude_stage_b_source_triage, claude_stage_c_drift_modelling, claude_stage_d_ais_correlation, claude_stage_e_investigators_dossier, claude_investigationcase_aggregate [EXTRACTED 1.00]
- **Teammate-Stage Adapter Pattern (Mock/Real Providers)** — claude_mock_providers_pattern, claude_stage_a_sar_detection, claude_stage_c_drift_modelling, claude_stage_d_ais_correlation [EXTRACTED 1.00]

## Communities (129 total, 112 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (87): Infrastructure Data Provenance, Pipeline PL-04 (Synthetic Fixture), Platform P-17 (Synthetic Fixture), Cross-Stage Interface Contracts Overview, TriageHypothesis Enum, VesselFeatures, AIS Track (Vocabulary), Candidate Vessel (Vocabulary) (+79 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (46): attribute(), AttributeRequest, BaseModel, post, POST /api/attribute (PRD §29). Runs Stage D only if Stage B routing allows it., drift(), DriftRequest, BaseModel (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (46): detect(), DetectRequest, BaseModel, post, POST /api/detect (PRD §29). MVP scope: serves the case's mock/real Stage A…, GeoJSONLineString, GeoJSONPoint, GeoJSONPolygon (+38 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (43): BaseModel, post, POST /api/triage (PRD §29). Simplification: accepts `{case_id}` and internally…, triage(), TriageRequest, Settings, _geodesic_distance_km(), InfrastructureDataset (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (47): Graphify Trigger Directive, add-watch.md Reference, graphify.ingest.ingest() URL Fetch, graphify.watch Background Watcher, exports.md Reference, Token Reduction Benchmark, FalkorDB Export/Push, MCP stdio Server (+39 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (35): get_case(), get_cases(), get_investigation(), BaseModel, post, run_investigation(), RunInvestigationRequest, get_case() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (36): extraction-spec.md Reference, Confidence Score Rubric (EXTRACTED/INFERRED/AMBIGUOUS), Hyperedges Rule, Node ID Format Rule, Semantic Similarity Rule, graphify reflect / LESSONS.md Work Memory, Honesty Rules, LLM Backend Fallback (Gemini key vs host-agent) (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (18): generate_report(), post, POST /api/report/{case_id} (PRD §29). Consumes an already-computed…, app_error_handler(), AppError, InvestigationNotFoundError, Typed domain exceptions mapped to structured HTTP error envelopes (PRD…, Base class for domain errors with a stable HTTP status and error type. (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (5): Demo Cases Provenance (OS-001/002/003), PRD Curated Demo First Principle, PRD Demo Cases (Vessel/Platform/Pipeline), PRD Mock Services Requirement, README Demo Cases Table

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): API Client (services/api.ts), Frontend Wizard Flow (Guided Investigation Narrative), Mapbox Map Layers

## Knowledge Gaps
- **126 isolated node(s):** `oil-spill-backend`, `README Ownership Section`, `README Repository Layout`, `README Getting Started (Backend/Frontend)`, `Platform P-17 (Synthetic Fixture)` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 235 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **112 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Not Yet Frozen — Open Items (§10, 11 items)` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.293) - this node is a cross-community bridge._
- **Why does `Stage 19 — Origin Probability Field & Cone Aggregation` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.293) - this node is a cross-community bridge._
- **Why does `Stage 27 — Synthetic AIS Scenario Generator` connect `Community 0` to `Community 6`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `Coordinate` (e.g. with `_geodesic_distance_km()` and `nearest_pipeline()`) actually correct?**
  _`Coordinate` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `run_investigation()` (e.g. with `Settings` and `AttributionProvider`) actually correct?**
  _`run_investigation()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `evaluate_triage()` (e.g. with `Settings` and `InfrastructureDataset`) actually correct?**
  _`evaluate_triage()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `oil-spill-backend`, `README Ownership Section`, `README Repository Layout` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._