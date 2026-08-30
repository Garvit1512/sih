"""Contract tests: GeoJSON coordinate ordering, UTC enforcement, and schema validation
of the checked-in mock fixtures (PRD §51)."""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.core.paths import CASES_DIR
from app.schemas.attribution import AttributionResult
from app.schemas.common import Coordinate, TimeWindow
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult


def test_coordinate_to_geojson_uses_lon_lat_order():
    coord = Coordinate(lat=15.23, lon=67.42)
    point = coord.to_geojson_point()
    assert point["coordinates"] == [67.42, 15.23]


def test_time_window_rejects_naive_datetime():
    with pytest.raises(ValidationError):
        TimeWindow(start="2026-08-29T06:00:00", end="2026-08-29T10:00:00")


def test_time_window_rejects_non_utc_offset():
    with pytest.raises(ValidationError):
        TimeWindow(start="2026-08-29T06:00:00+05:30", end="2026-08-29T10:00:00+05:30")


def test_time_window_accepts_utc():
    window = TimeWindow(start="2026-08-29T06:00:00Z", end="2026-08-29T10:00:00Z")
    assert window.start.utcoffset().total_seconds() == 0


@pytest.mark.parametrize("case_id", ["OS-001", "OS-002", "OS-003"])
def test_mock_detection_fixture_validates(case_id: str):
    with (CASES_DIR / case_id / "detection.json").open(encoding="utf-8") as f:
        DetectionResult.model_validate(json.load(f))


@pytest.mark.parametrize("case_id", ["OS-001", "OS-002", "OS-003"])
def test_mock_drift_fixture_validates(case_id: str):
    with (CASES_DIR / case_id / "drift.json").open(encoding="utf-8") as f:
        DriftResult.model_validate(json.load(f))


def test_mock_attribution_fixture_validates():
    with (CASES_DIR / "OS-001" / "attribution.json").open(encoding="utf-8") as f:
        AttributionResult.model_validate(json.load(f))


def test_invalid_detection_payload_fails_validation():
    with pytest.raises(ValidationError):
        DetectionResult.model_validate({"case_id": "X"})  # missing required fields
