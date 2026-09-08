"""Validation-failure path for Stage A/C/D providers (docs/stage-c-d-integration-plan.md
§5.2/§5.4 item 2): a malformed payload must surface as `UpstreamContractError` with a
stage- and case-specific message, never as a raw `pydantic.ValidationError` -- that is
the distinction CLAUDE.md §46 requires ("Stage A response failed DetectionResult schema
validation.")."""

from __future__ import annotations

import json

import pytest

from app.core.errors import UpstreamContractError
from app.integrations.mock.mock_attribution import MockAttributionProvider
from app.integrations.mock.mock_detection import MockDetectionProvider
from app.integrations.mock.mock_drift import MockDriftProvider
from app.integrations.validation import validate_stage_result
from app.schemas.detection import DetectionResult


def test_validate_stage_result_passes_through_a_valid_payload():
    payload = {
        "case_id": "OS-999",
        "executed": False,
        "reason": "test",
        "data_disclosure": None,
        "candidates": [],
        "low_confidence": False,
    }
    from app.schemas.attribution import AttributionResult

    result = validate_stage_result(
        AttributionResult, payload, stage="D", case_id="OS-999"
    )
    assert result.case_id == "OS-999"


def test_validate_stage_result_wraps_validation_error():
    with pytest.raises(UpstreamContractError) as exc_info:
        validate_stage_result(
            DetectionResult, {"case_id": "X"}, stage="A", case_id="X"
        )
    message = str(exc_info.value)
    assert "Stage A" in message
    assert "case 'X'" in message
    assert "DetectionResult" in message


@pytest.mark.parametrize(
    ("provider_cls", "filename", "stage_label"),
    [
        (MockDetectionProvider, "detection.json", "Stage A"),
        (MockDriftProvider, "drift.json", "Stage C"),
        (MockAttributionProvider, "attribution.json", "Stage D"),
    ],
)
def test_mock_provider_raises_upstream_contract_error_on_malformed_fixture(
    provider_cls, filename, stage_label, tmp_path, monkeypatch
):
    case_dir = tmp_path / "OS-BAD"
    case_dir.mkdir()
    (case_dir / filename).write_text(json.dumps({"case_id": "OS-BAD"}), encoding="utf-8")

    module = provider_cls.__module__
    monkeypatch.setattr(f"{module}.CASES_DIR", tmp_path)

    with pytest.raises(UpstreamContractError) as exc_info:
        provider_cls().get_result("OS-BAD")
    assert stage_label.split()[-1] in str(exc_info.value)  # "A" / "C" / "D"
