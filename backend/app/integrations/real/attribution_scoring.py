"""Real proximity + trajectory-alignment scoring for Stage D candidate vessels
(docs/staged-build-reference.md Stages 28-31; docs/stage-c-d-integration-plan.md §6).

A transparent weighted combination of two independently-visible feature scores -- never
a single opaque number, per PRD §8.5's explicit instruction that this must not be
marketed as more advanced than what is actually implemented and defensible.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Literal

from pyproj import Geod

from app.integrations.real.ais_generator import AISReport, AISTrack
from app.schemas.common import Coordinate, GeoJSONLineString, TimeWindow

_GEOD = Geod(ellps="WGS84")


def compute_drift_bearing(path: GeoJSONLineString) -> float:
    """Initial bearing of the hindcast path, origin -> next point: the direction the
    oil moved away from the origin. Falls back to 0.0 for a degenerate single-point
    path, which should not occur for any real hindcast."""
    coords = path.coordinates
    if len(coords) < 2:
        return 0.0
    lon1, lat1 = coords[0]
    lon2, lat2 = coords[1]
    azimuth, _, _ = _GEOD.inv(lon1, lat1, lon2, lat2)
    return azimuth % 360.0


def _geodesic_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    _, _, distance_m = _GEOD.inv(a_lon, a_lat, b_lon, b_lat)
    return distance_m / 1000.0


def filter_candidate(
    track: AISTrack,
    *,
    origin: Coordinate,
    window: TimeWindow,
    search_radius_km: float,
    pad_hours: float,
) -> tuple[float, AISReport] | None:
    """Space-time candidate filtering (staged-build Stage 28): keep only tracks with a
    report inside the padded origin time window AND within `search_radius_km` of the
    origin. Returns the closest such report and its distance, or None if the track is
    excluded."""
    pad = timedelta(hours=pad_hours)
    window_start = window.start - pad
    window_end = window.end + pad

    best_report: AISReport | None = None
    best_distance_km: float | None = None
    for report in track.reports:
        if not (window_start <= report.timestamp <= window_end):
            continue
        distance_km = _geodesic_km(origin.lat, origin.lon, report.lat, report.lon)
        if best_distance_km is None or distance_km < best_distance_km:
            best_distance_km = distance_km
            best_report = report

    if best_report is None or best_distance_km is None or best_distance_km > search_radius_km:
        return None
    return best_distance_km, best_report


def proximity_score(distance_km: float, search_radius_km: float) -> float:
    if search_radius_km <= 0:
        return 0.0
    return max(0.0, 100.0 * (1.0 - distance_km / search_radius_km))


def trajectory_alignment_score(course_deg: float, drift_bearing_deg: float) -> float:
    diff = abs((course_deg - drift_bearing_deg + 180.0) % 360.0 - 180.0)
    return max(0.0, 100.0 * (1.0 - diff / 180.0))


def confidence_tier(
    score: float, *, high_threshold: float, medium_threshold: float
) -> Literal["High", "Medium", "Low"]:
    if score >= high_threshold:
        return "High"
    if score >= medium_threshold:
        return "Medium"
    return "Low"


def build_evidence(distance_km: float, alignment_score: float) -> list[str]:
    proximity_line = (
        f"Vessel track passed within {distance_km:.1f} km of the estimated origin "
        "during the origin time window."
    )
    if alignment_score >= 70.0:
        qualifier = "closely consistent with"
    elif alignment_score >= 40.0:
        qualifier = "loosely consistent with"
    else:
        qualifier = "not consistent with"
    trajectory_line = f"Trajectory heading {qualifier} the backward drift path."
    return [proximity_line, trajectory_line]
