---
source_file: "backend/app/services/investigation_service.py"
type: "code"
community: "Investigation & Report Tests"
location: "L25"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Investigation__Report_Tests
---

# run_investigation()

## Connections
- [[AttributionProvider]] - `uses` [INFERRED]
- [[AttributionResult]] - `calls` [EXTRACTED]
- [[DetectionProvider]] - `uses` [INFERRED]
- [[DriftProvider]] - `uses` [INFERRED]
- [[InvestigationCase]] - `calls` [EXTRACTED]
- [[Settings]] - `uses` [INFERRED]
- [[evaluate_triage()]] - `calls` [EXTRACTED]
- [[generate()]] - `calls` [EXTRACTED]
- [[get_attribution_provider()]] - `calls` [EXTRACTED]
- [[get_case_or_raise()]] - `calls` [EXTRACTED]
- [[get_detection_provider()]] - `calls` [EXTRACTED]
- [[get_drift_provider()]] - `calls` [EXTRACTED]
- [[investigation_service.py]] - `contains` [EXTRACTED]
- [[load_infrastructure()]] - `calls` [EXTRACTED]
- [[run_investigation()]] - `calls` [EXTRACTED]
- [[save()]] - `calls` [EXTRACTED]
- [[test_investigation.py]] - `imports` [EXTRACTED]
- [[test_investigation_is_retrievable_after_run()]] - `calls` [EXTRACTED]
- [[test_pipeline_case_skips_stage_d_but_still_produces_report()]] - `calls` [EXTRACTED]
- [[test_platform_case_report_has_no_ais_disclosure_since_attribution_did_not_run()]] - `calls` [EXTRACTED]
- [[test_platform_case_skips_stage_d_but_still_produces_report()]] - `calls` [EXTRACTED]
- [[test_report_always_includes_all_known_limitations()]] - `calls` [EXTRACTED]
- [[test_report_never_uses_accusatory_language_in_vessel_evidence()]] - `calls` [EXTRACTED]
- [[test_reports.py]] - `imports` [EXTRACTED]
- [[test_vessel_case_report_includes_synthetic_ais_disclosure()]] - `calls` [EXTRACTED]
- [[test_vessel_case_runs_stage_d_and_produces_report()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Investigation__Report_Tests