"""Stage E report tests: disclaimer wording, limitations, synthetic AIS disclosure
(PRD §20, §47, §48; CLAUDE.md §1, §21)."""

from __future__ import annotations

from app.schemas.report import DISCLAIMER, KNOWN_LIMITATIONS, SYNTHETIC_AIS_DISCLOSURE
from app.services.investigation_service import run_investigation


def test_disclaimer_is_byte_identical_to_required_wording():
    assert DISCLAIMER == "this is a decision-support lead list, not a legal determination."


def test_vessel_case_report_includes_synthetic_ais_disclosure():
    investigation = run_investigation("OS-001")
    assert investigation.report.synthetic_ais_disclosure == SYNTHETIC_AIS_DISCLOSURE


def test_platform_case_report_has_no_ais_disclosure_since_attribution_did_not_run():
    investigation = run_investigation("OS-002")
    assert investigation.report.synthetic_ais_disclosure is None


def test_report_always_includes_all_known_limitations():
    investigation = run_investigation("OS-001")
    assert investigation.report.limitations == KNOWN_LIMITATIONS


def test_report_never_uses_accusatory_language_in_vessel_evidence():
    investigation = run_investigation("OS-001")
    forbidden_phrases = ["caused the spill", "is guilty", "confirmed responsible"]
    for candidate in investigation.attribution.candidates:
        for line in candidate.evidence:
            for phrase in forbidden_phrases:
                assert phrase not in line.lower()
