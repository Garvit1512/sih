"""RealDriftProvider (docs/stage-c-d-integration-plan.md §6): a genuine Lagrangian
particle-advection engine over an idealized synthetic current field. Verifies it
produces schema-valid, internally-consistent, deterministic output -- not that it
matches any particular oceanographic accuracy, which it explicitly does not claim."""

from __future__ import annotations

import json
import math

import pytest

from app.core.paths import CASES_DIR
from app.integrations.real.real_drift import RealDriftProvider
from app.schemas.detection import DetectionResult


def _load_detection(case_id: str) -> DetectionResult:
    with (CASES_DIR / case_id / "detection.json").open(encoding="utf-8") as f:
        return DetectionResult.model_validate(json.load(f))


def _km_between(lat1, lon1, lat2, lon2) -> float:
    # Small-distance flat approximation -- good enough for a "is this basically the
    # same point" assertion, not for anything the engine itself relies on.
    dlat_km = (lat1 - lat2) * 111.32
    dlon_km = (lon1 - lon2) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(dlat_km, dlon_km)


@pytest.mark.parametrize("case_id", ["OS-001", "OS-002", "OS-003", "OS-004"])
def test_real_drift_provider_produces_valid_result(case_id: str):
    detection = _load_detection(case_id)
    result = RealDriftProvider().get_result(case_id, detection=detection)

    assert result.case_id == case_id
    assert result.hindcast.origin_tolerance_km is not None
    assert result.hindcast.origin_tolerance_km > 0

    # Hindcast path is chronological: first point is the origin, last is the centroid.
    path_coords = result.hindcast.path.coordinates
    last_lon, last_lat = path_coords[-1]
    centroid = detection.spill.centroid
    assert _km_between(last_lat, last_lon, centroid.lat, centroid.lon) < 0.5
    first_lon, first_lat = path_coords[0]
    assert first_lat == pytest.approx(result.hindcast.origin.lat)
    assert first_lon == pytest.approx(result.hindcast.origin.lon)

    # Forecast path starts at the detection centroid.
    forecast_first_lon, forecast_first_lat = result.forecast.path.coordinates[0]
    assert _km_between(forecast_first_lat, forecast_first_lon, centroid.lat, centroid.lon) < 0.5

    # No coastline dataset exists -- these must be honestly null, not fabricated.
    assert result.forecast.time_to_coastline_hours is None
    assert result.forecast.time_to_sensitive_zone_hours is None

    # The synthetic-forcing disclosure must be present and legible.
    assert result.uncertainty is not None
    assert "synthetic" in result.uncertainty["disclosure"].lower()


def test_real_drift_provider_is_deterministic():
    detection = _load_detection("OS-001")
    first = RealDriftProvider().get_result("OS-001", detection=detection)
    second = RealDriftProvider().get_result("OS-001", detection=detection)
    assert first.model_dump() == second.model_dump()


def test_real_drift_provider_differs_by_case():
    result_1 = RealDriftProvider().get_result("OS-001", detection=_load_detection("OS-001"))
    result_2 = RealDriftProvider().get_result("OS-002", detection=_load_detection("OS-002"))
    assert result_1.hindcast.origin != result_2.hindcast.origin
