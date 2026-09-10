"""Stage A provider-selection and artifact-validation tests.

The point of these is the swap itself: PRD §67 requires that replacing mock Stage A with
real Stage A changes nothing in triage, orchestration, reporting, or the frontend. That
guarantee is only real if the real provider satisfies the same Protocol and the same
contract, which is what this asserts.
"""

from __future__ import annotations

import json

import pytest

from app.core.errors import CaseNotFoundError
from app.integrations.mock.mock_detection import MockDetectionProvider
from app.integrations.real.real_detection import (
    ARTIFACT_NAME,
    RealDetectionProvider,
    StageAContractError,
)
from app.schemas.detection import DetectionResult

VALID_ARTIFACT = {
    "case_id": "OS-001",
    "detected_at": "2026-08-29T10:30:00Z",
    "spill": {
        "centroid": {"lat": 15.23, "lon": 67.42},
        "polygon": {
            "type": "Polygon",
            "coordinates": [
                [
                    [67.40, 15.21],
                    [67.44, 15.21],
                    [67.44, 15.25],
                    [67.40, 15.25],
                    [67.40, 15.21],
                ]
            ],
        },
        "area_km2": 5.2,
        "perimeter_km": 11.4,
        "elongation": 2.8,
        "coastline_distance_km": 42.0,
    },
    "detection_confidence": {
        "value": 0.87,
        "type": "indicative_uncalibrated",
        "label": "Indicative detection confidence",
    },
}


def _write_artifact(tmp_path, payload, case_id="OS-001", name=ARTIFACT_NAME):
    case_dir = tmp_path / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    (case_dir / name).write_text(json.dumps(payload), encoding="utf-8")
    return tmp_path


def test_real_provider_matches_the_mock_provider_shape():
    """Structural check: the swap in PRD §67 only works if the shape matches.

    `DetectionProvider` is a plain (not runtime-checkable) Protocol, which is correct for
    a static-typing contract — so this compares the two implementations structurally
    rather than adding `@runtime_checkable` to a frozen contract file for a test's sake.
    """
    import inspect

    real_signature = inspect.signature(RealDetectionProvider.get_result)
    mock_signature = inspect.signature(MockDetectionProvider.get_result)

    assert list(real_signature.parameters) == list(mock_signature.parameters) == ["self", "case_id"]
    assert real_signature.return_annotation == mock_signature.return_annotation


def test_reads_and_validates_a_real_artifact(tmp_path):
    provider = RealDetectionProvider(cases_dir=_write_artifact(tmp_path, VALID_ARTIFACT))

    result = provider.get_result("OS-001")

    assert isinstance(result, DetectionResult)
    assert result.spill.area_km2 == 5.2
    assert result.detection_confidence.type == "indicative_uncalibrated"


def test_provenance_keys_are_stripped_before_validation(tmp_path):
    """Stage A attaches its own evidence; those keys are not contract fields."""
    payload = dict(VALID_ARTIFACT, _provenance={"producer": "stage_a.pipeline"})
    provider = RealDetectionProvider(cases_dir=_write_artifact(tmp_path, payload))

    assert provider.get_result("OS-001").case_id == "OS-001"


def test_missing_artifact_names_the_command_that_produces_it(tmp_path):
    provider = RealDetectionProvider(cases_dir=tmp_path)

    with pytest.raises(CaseNotFoundError, match="stage_a.cli detect"):
        provider.get_result("OS-404")


def test_invalid_artifact_fails_clearly_rather_than_being_repaired(tmp_path):
    """CLAUDE.md §46: a malformed upstream payload must fail loudly."""
    broken = dict(VALID_ARTIFACT)
    broken["spill"] = dict(broken["spill"], area_km2=-1)  # violates ge=0

    provider = RealDetectionProvider(cases_dir=_write_artifact(tmp_path, broken))

    with pytest.raises(StageAContractError, match="failed DetectionResult schema validation"):
        provider.get_result("OS-001")


def test_naive_timestamp_in_artifact_is_rejected(tmp_path):
    """The UTC time contract is enforced at the integration boundary too (PRD §10)."""
    naive = dict(VALID_ARTIFACT, detected_at="2026-08-29T10:30:00")
    provider = RealDetectionProvider(cases_dir=_write_artifact(tmp_path, naive))

    with pytest.raises(StageAContractError):
        provider.get_result("OS-001")


def test_real_artifact_uses_a_distinct_filename_from_the_mock():
    """Mock and real must never be confusable — a shared filename is how that happens."""
    assert ARTIFACT_NAME != "detection.json"


def test_provider_selection_follows_config(monkeypatch):
    from app.core import config as config_module
    from app.integrations import stage_a as stage_a_module

    monkeypatch.setattr(config_module.settings, "stage_a_mode", "mock")
    assert isinstance(stage_a_module.get_detection_provider(), MockDetectionProvider)

    monkeypatch.setattr(config_module.settings, "stage_a_mode", "real")
    assert isinstance(stage_a_module.get_detection_provider(), RealDetectionProvider)
