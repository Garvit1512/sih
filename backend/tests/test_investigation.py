"""Integration tests (PRD §50): full Stage A -> C -> B -> [D] -> E chains for all three
demo cases, proving Stage B actually gates vessel attribution."""

from __future__ import annotations

from app.schemas.report import DISCLAIMER
from app.schemas.triage import TriageHypothesis
from app.services.investigation_service import run_investigation


def test_vessel_case_runs_stage_d_and_produces_report():
    investigation = run_investigation("OS-001")
    assert investigation.triage.hypothesis == TriageHypothesis.LIKELY_VESSEL
    assert investigation.attribution.executed is True
    assert len(investigation.attribution.candidates) > 0
    assert investigation.report is not None
    assert investigation.report.disclaimer == DISCLAIMER


def test_platform_case_skips_stage_d_but_still_produces_report():
    investigation = run_investigation("OS-002")
    assert investigation.triage.hypothesis == TriageHypothesis.LIKELY_PLATFORM
    assert investigation.attribution.executed is False
    assert investigation.attribution.reason is not None
    assert investigation.attribution.candidates == []
    assert investigation.report is not None
    assert investigation.report.disclaimer == DISCLAIMER


def test_pipeline_case_skips_stage_d_but_still_produces_report():
    investigation = run_investigation("OS-003")
    assert investigation.triage.hypothesis == TriageHypothesis.LIKELY_PIPELINE
    assert investigation.attribution.executed is False
    assert investigation.attribution.reason is not None
    assert investigation.report is not None
    assert investigation.report.disclaimer == DISCLAIMER


def test_investigation_is_retrievable_after_run():
    from app.services.investigation_service import get_investigation

    run_investigation("OS-001")
    fetched = get_investigation("OS-001")
    assert fetched is not None
    assert fetched.case_id == "OS-001"


def test_insufficient_evidence_case_runs_stage_d_with_low_confidence():
    investigation = run_investigation("OS-004")
    assert investigation.triage.hypothesis == TriageHypothesis.INSUFFICIENT_EVIDENCE
    assert investigation.triage.routing.run_vessel_attribution is True
    assert investigation.triage.routing.low_confidence is True
    assert investigation.attribution.executed is True
    assert investigation.attribution.low_confidence is True
    assert investigation.report is not None
    assert investigation.report.disclaimer == DISCLAIMER
