"""Stages 7-9 assembled — scene in, frozen `DetectionResult` payload out.

This module is the seam between Stage A's internals and the rest of the system. Nothing
downstream (Stage B triage, the orchestrator, Stage E's dossier, the frontend) knows this
package exists; they know only the contract in docs/contracts.md, which this module
emits.

It deliberately does not import from `backend/`. Stage A is upstream of the service and
must stay runnable as a standalone model repo — the payload is validated against the real
Pydantic schema in the tests, where the backend is importable, rather than at runtime.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from stage_a.confidence import extract_confidence
from stage_a.config import OIL_SPILL_CLASS
from stage_a.geometry import extract_properties
from stage_a.vectorize import (
    centroid_coordinate,
    largest_polygon,
    mask_to_polygons,
    polygon_to_geojson,
    to_wgs84,
)


class NoDetectionError(RuntimeError):
    """Raised when the model finds no oil-spill pixels in a scene.

    CONTRACT NOTE (raise with the team before "fixing" this): `DetectionResult` has no
    representation for "ran successfully, found nothing" — `spill` is a required field
    with a required polygon. Stage A therefore cannot report a clean negative through the
    frozen contract.

    Fabricating an empty or zero-area polygon to satisfy the schema would be worse than
    failing: Stage C would seed a drift simulation from a meaningless centroid and Stage B
    would triage a spill that does not exist. Per CLAUDE.md §72 this is reported as a
    contract insufficiency rather than silently worked around.
    """


def detect_scene(
    scene,
    *,
    case_id: str,
    detected_at: datetime,
    probabilities: np.ndarray,
    class_mask: np.ndarray,
    coastline_wgs84: Any = None,
    min_area_px: int = 25,
    simplify_tolerance_m: float | None = 30.0,
) -> dict:
    """Turn model output over one scene into a `DetectionResult` payload.

    Args:
        scene: the `Scene` the mask was produced from (carries transform + CRS).
        detected_at: the scene's acquisition time, timezone-aware and UTC.
        probabilities: softmax output, (C, H, W).
        class_mask: argmax class indices, (H, W).
        coastline_wgs84: optional coastline geometry; without it the contract's optional
            `coastline_distance_km` is emitted as null rather than a fabricated number.

    Raises:
        NoDetectionError: if no oil-spill region survives `min_area_px`.
        ValueError: if `detected_at` is naive or not UTC.
    """
    _require_utc(detected_at)

    polygons = mask_to_polygons(
        class_mask,
        target_class=OIL_SPILL_CLASS,
        transform=scene.transform,
        crs=scene.crs,
        min_area_px=min_area_px,
        simplify_tolerance_m=simplify_tolerance_m,
    )
    if not polygons:
        raise NoDetectionError(
            f"No oil-spill region above {min_area_px} px in scene for case '{case_id}'."
        )

    # The contract carries a single Polygon. Where a spill vectorizes into several
    # patches we take the largest and record how many were set aside, so the omission is
    # visible in provenance rather than silent.
    spill_source_crs = largest_polygon(polygons)
    discarded = len(polygons) - 1

    spill_wgs84 = to_wgs84(spill_source_crs, scene.crs)
    properties = extract_properties(spill_wgs84, coastline_wgs84)
    confidence = extract_confidence(probabilities, class_mask)

    if confidence is None:  # pragma: no cover - unreachable while polygons is non-empty
        raise NoDetectionError(f"Polygon found but no confidence derivable for case '{case_id}'.")

    payload = {
        "case_id": case_id,
        "detected_at": detected_at.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        "spill": {
            "centroid": centroid_coordinate(spill_wgs84),
            "polygon": polygon_to_geojson(spill_wgs84),
            "area_km2": round(properties.area_km2, 4),
            "perimeter_km": round(properties.perimeter_km, 4),
            "elongation": round(properties.elongation, 4),
            "coastline_distance_km": (
                round(properties.coastline_distance_km, 4)
                if properties.coastline_distance_km is not None
                else None
            ),
        },
        "detection_confidence": confidence.to_contract(),
    }

    payload["_provenance"] = {
        "producer": "stage_a.pipeline",
        "source_scene": str(scene.source_path) if scene.source_path else None,
        "additional_patches_discarded": discarded,
        "confidence_components": {
            "mean_oil_probability": confidence.mean_oil_probability,
            "mean_look_alike_probability": confidence.mean_look_alike_probability,
            "detected_pixel_count": confidence.detected_pixel_count,
        },
        "evidence": confidence.evidence_lines(),
    }
    return payload


def _require_utc(value: datetime) -> datetime:
    """Mirror of the backend's `require_utc` — the time contract applies here too."""
    if value.tzinfo is None:
        raise ValueError("detected_at must be timezone-aware (UTC); received a naive datetime")
    if value.utcoffset() != UTC.utcoffset(value):
        raise ValueError("detected_at must be UTC (offset +00:00)")
    return value


def write_artifact(payload: dict, path: Path) -> Path:
    """Persist a detection payload as the case artifact the backend reads.

    Writing an artifact rather than serving live inference is deliberate (Stage 39's case
    artifact store): the demo must never depend on a model forward pass completing on
    stage, and the result a judge sees must be identical on every run.
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path
