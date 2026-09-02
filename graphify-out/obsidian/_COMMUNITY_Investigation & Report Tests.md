---
type: community
cohesion: 0.09
members: 44
---

# Investigation & Report Tests

**Cohesion:** 0.09 - loosely connected
**Members:** 44 nodes

## Members
- [[BaseModel_10]] - code
- [[BaseModel_11]] - code
- [[CaseMeta]] - code - backend/app/schemas/investigation.py
- [[Curated demo case registry (PRD §52). Deterministic, hand-verified metadata --…]] - rationale - backend/app/data/demo_cases.py
- [[Identity Contract case_id  vessel_id (§1.6)]] - concept - docs/contracts.md
- [[In-memory investigation state store (PRD §61§62 -- no DB required for MVP).…]] - rationale - backend/app/data/repositories/investigation_repository.py
- [[Integration tests (PRD §50) full Stage A - C - B - D - E chains for all…]] - rationale - backend/tests/test_investigation.py
- [[InvestigationCase]] - code - backend/app/schemas/investigation.py
- [[InvestigationCase (Aggregate)]] - concept - docs/contracts.md
- [[InvestigationCase — the canonical aggregate the frontend consumes (PRD §8§26).…]] - rationale - backend/app/schemas/investigation.py
- [[PRD Data Flow InvestigationCase]] - concept - prd.md
- [[RunInvestigationRequest]] - code - backend/app/api/investigation.py
- [[Stage E report tests disclaimer wording, limitations, synthetic AIS disclosure…]] - rationale - backend/tests/test_reports.py
- [[apiinvestigation.py]] - code - backend/app/api/investigation.py
- [[case_service.py]] - code - backend/app/services/case_service.py
- [[cases.py]] - code - backend/app/api/cases.py
- [[demo_cases.py]] - code - backend/app/data/demo_cases.py
- [[get()]] - code - backend/app/data/repositories/investigation_repository.py
- [[get_all_cases()]] - code - backend/app/services/case_service.py
- [[get_case()]] - code - backend/app/api/cases.py
- [[get_case()_1]] - code - backend/app/data/demo_cases.py
- [[get_case_or_raise()]] - code - backend/app/services/case_service.py
- [[get_cases()]] - code - backend/app/api/cases.py
- [[get_investigation()]] - code - backend/app/api/investigation.py
- [[get_investigation()_1]] - code - backend/app/services/investigation_service.py
- [[health()]] - code - backend/app/main.py
- [[investigation_repository.py]] - code - backend/app/data/repositories/investigation_repository.py
- [[list_cases()]] - code - backend/app/data/demo_cases.py
- [[post_4]] - code
- [[run_investigation()]] - code - backend/app/api/investigation.py
- [[run_investigation()_1]] - code - backend/app/services/investigation_service.py
- [[save()]] - code - backend/app/data/repositories/investigation_repository.py
- [[schemasinvestigation.py]] - code - backend/app/schemas/investigation.py
- [[test_disclaimer_is_byte_identical_to_required_wording()]] - code - backend/tests/test_reports.py
- [[test_investigation.py]] - code - backend/tests/test_investigation.py
- [[test_investigation_is_retrievable_after_run()]] - code - backend/tests/test_investigation.py
- [[test_pipeline_case_skips_stage_d_but_still_produces_report()]] - code - backend/tests/test_investigation.py
- [[test_platform_case_report_has_no_ais_disclosure_since_attribution_did_not_run()]] - code - backend/tests/test_reports.py
- [[test_platform_case_skips_stage_d_but_still_produces_report()]] - code - backend/tests/test_investigation.py
- [[test_report_always_includes_all_known_limitations()]] - code - backend/tests/test_reports.py
- [[test_report_never_uses_accusatory_language_in_vessel_evidence()]] - code - backend/tests/test_reports.py
- [[test_reports.py]] - code - backend/tests/test_reports.py
- [[test_vessel_case_report_includes_synthetic_ais_disclosure()]] - code - backend/tests/test_reports.py
- [[test_vessel_case_runs_stage_d_and_produces_report()]] - code - backend/tests/test_investigation.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Investigation__Report_Tests
SORT file.name ASC
```

## Connections to other communities
- 24 edges to [[_COMMUNITY_Stage B Triage & Infrastructure]]
- 12 edges to [[_COMMUNITY_Investigation API & Orchestration]]
- 8 edges to [[_COMMUNITY_Drift Forecast & Open Items]]
- 7 edges to [[_COMMUNITY_Vessel Attribution & Synthetic AIS]]

## Top bridge nodes
- [[run_investigation()_1]] - degree 26, connects to 3 communities
- [[schemasinvestigation.py]] - degree 20, connects to 3 communities
- [[test_investigation.py]] - degree 11, connects to 3 communities
- [[CaseMeta]] - degree 14, connects to 2 communities
- [[InvestigationCase]] - degree 13, connects to 2 communities