"""Full orchestration with the real Stage C/D engines wired in via explicit provider
injection (docs/stage-c-d-integration-plan.md §5.4 item 3), proving the Protocol
adapter pattern actually works: the orchestrator, Stage B, and Stage E run unchanged
regardless of which provider produced `DriftResult`/`AttributionResult`.

Deliberately does NOT assert a specific triage hypothesis: the real engine's idealized
synthetic current field seeds from the detection centroid and moves it by a physically
different amount than the hand-placed mock fixture origin, so it may or may not land
near the same infrastructure the mock fixture was authored to sit next to. Asserting a
specific hypothesis here would be asserting a coincidence, not a property of the
system."""

from __future__ import annotations

from app.integrations.mock.mock_detection import MockDetectionProvider
from app.integrations.real.real_attribution import RealAttributionProvider
from app.integrations.real.real_drift import RealDriftProvider
from app.schemas.report import DISCLAIMER
from app.services.investigation_service import run_investigation


def test_full_investigation_runs_end_to_end_with_real_c_and_d():
    investigation = run_investigation(
        "OS-001",
        detection_provider=MockDetectionProvider(),
        drift_provider=RealDriftProvider(),
        attribution_provider=RealAttributionProvider(),
    )

    assert investigation.status == "complete"
    assert investigation.drift.hindcast.origin_tolerance_km is not None
    assert investigation.report is not None
    assert investigation.report.disclaimer == DISCLAIMER

    if investigation.triage.routing.run_vessel_attribution:
        assert investigation.attribution.executed is True
        assert investigation.attribution.data_disclosure is not None
        assert investigation.attribution.data_disclosure.ais_type == "synthetic"
    else:
        assert investigation.attribution.executed is False
        assert investigation.attribution.candidates == []
