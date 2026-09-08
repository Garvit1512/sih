"""A real Lagrangian particle-advection engine, driven by an idealized, deterministic
synthetic current field -- NOT real oceanographic data.

This exists because a genuine OpenDrift/OpenOil engine needs real NOAA OSCAR / HYCOM /
Copernicus current and wind data, and nothing of the kind exists anywhere in this repo
(see docs/stage-c-d-integration-plan.md §3 item 1). Fabricating a "real" origin estimate
without real forcing data would misrepresent drift accuracy (CLAUDE.md §60/§71). This
module is the disclosed middle ground: a real advection algorithm -- the same class of
technique OpenDrift uses internally -- integrated against a current field that is
openly synthetic.

The per-case current parameters (`base_speed_mps`, `base_bearing_deg`) are derived once
by `derive_idealized_current_parameters()` and persisted to
`data/synthetic_forcing/<case_id>/current_field.json` by
`backend/scripts/generate_synthetic_datasets.py` -- this module does not re-derive them
at request time. `RealDriftProvider` reads the persisted file
(`app/integrations/real/forcing_data.py`) so the "dataset" behind Stage C is an
inspectable, version-controlled artifact, the same way real forcing-data caching
(staged-build Stage 4) would be, even though its contents are synthetic.

Every function here is pure and deterministic given its inputs; no shared mutable
state, no wall-clock dependence.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from pyproj import Geod

_GEOD = Geod(ellps="WGS84")

_OSCILLATION_AMPLITUDE_DEG = 15.0
_OSCILLATION_PERIOD_HOURS = 6.0


def derive_idealized_current_parameters(case_id: str) -> tuple[float, float]:
    """Deterministically derive `(base_speed_mps, base_bearing_deg)` for a case, seeded
    by `case_id`. Called ONLY by `generate_synthetic_datasets.py` to produce the
    persisted `current_field.json` -- not called by any provider at request time. A
    fixed base speed (0.15-0.45 m/s, a plausible surface-current magnitude, picked to be
    plausible-looking, not measured) and bearing per case."""
    rng = random.Random(f"stage-c-idealized-current:{case_id}")
    base_speed_mps = rng.uniform(0.15, 0.45)
    base_bearing_deg = rng.uniform(0.0, 360.0)
    return base_speed_mps, base_bearing_deg


def current_at(
    base_speed_mps: float, base_bearing_deg: float, *, hours_from_detection: float
) -> tuple[float, float]:
    """(east, north) current in m/s at a given time offset, given this case's
    persisted base speed/bearing. A slow sinusoidal bearing oscillation over time makes
    the resulting path curve rather than run dead straight -- still fully determined by
    the inputs, nothing non-reproducible."""
    oscillation_deg = _OSCILLATION_AMPLITUDE_DEG * math.sin(
        hours_from_detection / _OSCILLATION_PERIOD_HOURS
    )
    bearing_rad = math.radians(base_bearing_deg + oscillation_deg)
    u = base_speed_mps * math.sin(bearing_rad)
    v = base_speed_mps * math.cos(bearing_rad)
    return u, v


def step_point(
    lat: float, lon: float, u_mps: float, v_mps: float, dt_seconds: float
) -> tuple[float, float]:
    """Advance one point by the given (east, north) velocity over `dt_seconds`
    (negative for a backward step) along the WGS84 ellipsoid."""
    speed = math.hypot(u_mps, v_mps)
    if speed == 0.0 or dt_seconds == 0.0:
        return lat, lon
    bearing_deg = math.degrees(math.atan2(u_mps, v_mps)) % 360.0
    distance_m = speed * dt_seconds
    lon2, lat2, _ = _GEOD.fwd(lon, lat, bearing_deg, distance_m)
    return lat2, lon2


PathPoint = tuple[datetime, float, float]


def compute_backward_path(
    *,
    base_speed_mps: float,
    base_bearing_deg: float,
    start_lat: float,
    start_lon: float,
    start_time: datetime,
    hours: float,
    step_minutes: float,
) -> list[PathPoint]:
    """Simulate backward from `(start_lat, start_lon, start_time)` -- the detection
    centroid and timestamp -- for `hours`, using the given case's persisted current
    parameters. Returns chronological order: earliest (the origin estimate) first, the
    detection instant last."""
    step_seconds = step_minutes * 60.0
    n_steps = max(1, round((hours * 3600.0) / step_seconds))
    lat, lon = start_lat, start_lon
    points: list[PathPoint] = [(start_time, lat, lon)]
    for i in range(1, n_steps + 1):
        hours_elapsed = -(i * step_seconds) / 3600.0
        u, v = current_at(base_speed_mps, base_bearing_deg, hours_from_detection=hours_elapsed)
        lat, lon = step_point(lat, lon, u, v, -step_seconds)
        t = start_time - timedelta(seconds=i * step_seconds)
        points.append((t, lat, lon))
    return list(reversed(points))


def compute_forward_path(
    *,
    base_speed_mps: float,
    base_bearing_deg: float,
    start_lat: float,
    start_lon: float,
    start_time: datetime,
    hours: float,
    step_minutes: float,
) -> list[PathPoint]:
    """Simulate forward from `(start_lat, start_lon, start_time)` for `hours`, using the
    given case's persisted current parameters. Returns chronological order: the
    detection instant first, the forecast horizon last."""
    step_seconds = step_minutes * 60.0
    n_steps = max(1, round((hours * 3600.0) / step_seconds))
    lat, lon = start_lat, start_lon
    points: list[PathPoint] = [(start_time, lat, lon)]
    for i in range(1, n_steps + 1):
        hours_elapsed = (i * step_seconds) / 3600.0
        u, v = current_at(base_speed_mps, base_bearing_deg, hours_from_detection=hours_elapsed)
        lat, lon = step_point(lat, lon, u, v, step_seconds)
        t = start_time + timedelta(seconds=i * step_seconds)
        points.append((t, lat, lon))
    return points
