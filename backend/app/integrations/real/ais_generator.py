"""A real, deterministic synthetic AIS scenario generator (docs/staged-build-reference.md
Stage 27, and docs/stage-c-d-integration-plan.md §6).

Produces one or more "planted" vessel tracks on a course consistent with the drift
path's bearing, passing close to the estimated origin during the origin time window,
plus background traffic on unrelated courses and a wider spread of closest-approach
distances -- deterministic per `case_id`, never re-randomized between calls (CLAUDE.md
§28: "a judge should see the same result every time"). This is genuinely synthetic AIS,
not live vessel traffic -- carried through to `AttributionResult.data_disclosure`
(CLAUDE.md §21).
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta

from pyproj import Geod

from app.schemas.common import Coordinate, TimeWindow

_GEOD = Geod(ellps="WGS84")
_KNOTS_TO_MPS = 0.514444

_VESSEL_NAMES = [
    "Vessel Alpha", "Vessel Bravo", "Vessel Charlie", "Vessel Delta",
    "Vessel Echo", "Vessel Foxtrot", "Vessel Golf", "Vessel Hotel",
    "Vessel India", "Vessel Juliett",
]


@dataclass(frozen=True)
class AISReport:
    timestamp: datetime
    lat: float
    lon: float
    speed_knots: float
    course_deg: float


@dataclass(frozen=True)
class AISTrack:
    vessel_id: str
    vessel_name: str
    reports: list[AISReport]


def generate_scenario(
    *,
    case_id: str,
    origin: Coordinate,
    origin_time_window: TimeWindow,
    drift_bearing_deg: float,
    background_count: int,
    planted_count: int = 1,
) -> list[AISTrack]:
    rng = random.Random(f"stage-d-ais-scenario:{case_id}")
    window_mid = origin_time_window.start + (origin_time_window.end - origin_time_window.start) / 2

    tracks: list[AISTrack] = []
    for _ in range(planted_count):
        tracks.append(
            _build_track(
                rng=rng,
                vessel_id=f"MMSI-9{rng.randint(10000, 99999)}",
                vessel_name=_VESSEL_NAMES[rng.randrange(len(_VESSEL_NAMES))],
                origin=origin,
                approach_bearing_deg=rng.uniform(0.0, 360.0),
                offset_km=rng.uniform(0.5, 4.0),
                course_deg=drift_bearing_deg,
                speed_knots=rng.uniform(8.0, 16.0),
                center_time=window_mid,
            )
        )

    for i in range(background_count):
        tracks.append(
            _build_track(
                rng=rng,
                vessel_id=f"MMSI-1{rng.randint(10000, 99999)}",
                vessel_name=f"Background Vessel {i + 1}",
                origin=origin,
                approach_bearing_deg=rng.uniform(0.0, 360.0),
                offset_km=rng.uniform(25.0, 110.0),
                course_deg=rng.uniform(0.0, 360.0),
                speed_knots=rng.uniform(6.0, 20.0),
                center_time=window_mid,
            )
        )
    return tracks


def serialize_tracks(tracks: list[AISTrack]) -> list[dict]:
    """JSON-ready representation, for `generate_synthetic_datasets.py` to persist.
    Paired with `ais_data.load_scenario()`, which reconstructs `AISTrack`/`AISReport`
    from this exact shape."""
    return [
        {
            "vessel_id": track.vessel_id,
            "vessel_name": track.vessel_name,
            "reports": [
                {
                    "timestamp": report.timestamp.isoformat(),
                    "lat": report.lat,
                    "lon": report.lon,
                    "speed_knots": report.speed_knots,
                    "course_deg": report.course_deg,
                }
                for report in track.reports
            ],
        }
        for track in tracks
    ]


def _build_track(
    *,
    rng: random.Random,
    vessel_id: str,
    vessel_name: str,
    origin: Coordinate,
    approach_bearing_deg: float,
    offset_km: float,
    course_deg: float,
    speed_knots: float,
    center_time: datetime,
) -> AISTrack:
    closest_lon, closest_lat, _ = _GEOD.fwd(
        origin.lon, origin.lat, approach_bearing_deg, offset_km * 1000.0
    )
    speed_mps = speed_knots * _KNOTS_TO_MPS
    reports = []
    for offset_hours in (-2.0, -1.0, 0.0, 1.0, 2.0):
        distance_m = speed_mps * offset_hours * 3600.0
        lon, lat, _ = _GEOD.fwd(closest_lon, closest_lat, course_deg, distance_m)
        reports.append(
            AISReport(
                timestamp=center_time + timedelta(hours=offset_hours),
                lat=lat,
                lon=lon,
                speed_knots=round(speed_knots, 1),
                course_deg=round(course_deg % 360.0, 1),
            )
        )
    return AISTrack(vessel_id=vessel_id, vessel_name=vessel_name, reports=reports)
