"""The integration proof: Stage A's output validates against the real frozen contract.

This suite imports the backend's actual Pydantic model rather than restating its shape.
A hand-copied expectation would drift the moment the contract changed and would still
pass — which is precisely the cross-stage integration failure Stage 1 exists to prevent.

No torch, no dataset, no GPU: model output is synthesized, so the contract boundary is
verifiable on any machine.
"""

from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pytest
from rasterio.transform import from_origin

from stage_a.config import LOOK_ALIKE_CLASS, NUM_CLASSES, OIL_SPILL_CLASS
from stage_a.inference import Scene
from stage_a.pipeline import NoDetectionError, detect_scene, write_artifact

BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

DetectionResult = pytest.importorskip(
    "app.schemas.detection", reason="backend package not importable"
).DetectionResult


def _scene(rows=64, cols=64):
    return Scene(
        image=np.zeros((rows, cols, 3), dtype=np.float32),
        transform=from_origin(67.0, 15.5, 0.001, 0.001),
        crs="EPSG:4326",
        source_path=Path("OS-001/scene.tif"),
    )


def _model_output(rows=64, cols=64, region=slice(16, 40), oil=0.88, look_alike=0.06):
    mask = np.zeros((rows, cols), dtype=np.uint8)
    mask[region, region] = OIL_SPILL_CLASS

    probabilities = np.full((NUM_CLASSES, rows, cols), 0.01, dtype=np.float32)
    probabilities[0] = 0.9
    probabilities[OIL_SPILL_CLASS][region, region] = oil
    probabilities[LOOK_ALIKE_CLASS][region, region] = look_alike
    return probabilities, mask


def _detect(**overrides):
    probabilities, mask = _model_output()
    kwargs = dict(
        case_id="OS-001",
        detected_at=datetime(2026, 8, 29, 10, 30, tzinfo=UTC),
        probabilities=probabilities,
        class_mask=mask,
    )
    kwargs.update(overrides)
    return detect_scene(_scene(), **kwargs)


def test_payload_validates_against_the_frozen_schema():
    payload = {k: v for k, v in _detect().items() if not k.startswith("_")}

    result = DetectionResult.model_validate(payload)

    assert result.case_id == "OS-001"
    assert result.spill.area_km2 > 0
    assert result.detection_confidence.type == "indicative_uncalibrated"


def test_centroid_lands_in_the_scene_not_in_the_wrong_hemisphere():
    """End-to-end axis-order check, through every transform in the pipeline."""
    payload = _detect()
    centroid = payload["spill"]["centroid"]

    assert 15.4 < centroid["lat"] < 15.6
    assert 66.9 < centroid["lon"] < 67.1


def test_polygon_ring_is_lon_lat_ordered():
    ring = _detect()["spill"]["polygon"]["coordinates"][0]

    assert all(66.9 < lon < 67.1 for lon, _ in ring)
    assert all(15.4 < lat < 15.6 for _, lat in ring)


def test_naive_timestamp_is_rejected():
    """The time contract is enforced in Stage A, not only at the API boundary."""
    with pytest.raises(ValueError, match="timezone-aware"):
        _detect(detected_at=datetime(2026, 8, 29, 10, 30))


def test_non_utc_timestamp_is_rejected():
    ist = timezone(timedelta(hours=5, minutes=30))
    with pytest.raises(ValueError, match="UTC"):
        _detect(detected_at=datetime(2026, 8, 29, 16, 0, tzinfo=ist))


def test_empty_detection_raises_rather_than_fabricating_a_polygon():
    """The contract cannot express 'found nothing'; inventing a polygon would be worse."""
    probabilities = np.full((NUM_CLASSES, 64, 64), 0.02, dtype=np.float32)
    probabilities[0] = 0.92
    empty_mask = np.zeros((64, 64), dtype=np.uint8)

    with pytest.raises(NoDetectionError):
        _detect(probabilities=probabilities, class_mask=empty_mask)


def test_coastline_distance_is_null_when_no_coastline_supplied():
    assert _detect()["spill"]["coastline_distance_km"] is None


def test_coastline_distance_is_populated_when_supplied():
    from shapely.geometry import LineString

    payload = _detect(coastline_wgs84=LineString([(67.5, 15.0), (67.5, 16.0)]))

    distance = payload["spill"]["coastline_distance_km"]
    assert distance is not None and distance > 0


def test_provenance_records_discarded_patches():
    """A multi-patch spill must not lose oil silently."""
    rows = cols = 64
    mask = np.zeros((rows, cols), dtype=np.uint8)
    mask[8:24, 8:24] = OIL_SPILL_CLASS   # larger patch
    mask[40:52, 40:52] = OIL_SPILL_CLASS  # second, smaller patch

    probabilities = np.full((NUM_CLASSES, rows, cols), 0.01, dtype=np.float32)
    probabilities[0] = 0.9
    probabilities[OIL_SPILL_CLASS][mask == OIL_SPILL_CLASS] = 0.85
    probabilities[LOOK_ALIKE_CLASS][mask == OIL_SPILL_CLASS] = 0.08

    payload = _detect(probabilities=probabilities, class_mask=mask)

    assert payload["_provenance"]["additional_patches_discarded"] == 1


def test_artifact_round_trips_and_still_validates(tmp_path):
    import json

    path = write_artifact(_detect(), tmp_path / "OS-001" / "detection.json")
    payload = json.loads(path.read_text(encoding="utf-8"))

    DetectionResult.model_validate({k: v for k, v in payload.items() if not k.startswith("_")})
    assert payload["_provenance"]["producer"] == "stage_a.pipeline"
