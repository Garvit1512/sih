"""Stage C real provider: a genuine Lagrangian particle-advection drift engine, driven
by an idealized, deterministic synthetic current field -- NOT real oceanographic data.

See `drift_physics.py`'s module docstring and docs/stage-c-d-integration-plan.md §3 for
why: real OpenDrift/OpenOil needs real NOAA/Copernicus current+wind data that doesn't
exist in this repo and can't be fabricated without misrepresenting drift accuracy
(CLAUDE.md §60/§71). This is the disclosed middle ground the team chose instead: a real
advection algorithm, openly run on synthetic forcing, never presented as calibrated
oceanographic accuracy. The `uncertainty` field on every result it produces carries that
disclosure -- see `SYNTHETIC_FORCING_DISCLOSURE` below.

The current-field parameters come from `data/synthetic_forcing/<case_id>/current_field.json`
(`forcing_data.py`), generated once by `backend/scripts/generate_synthetic_datasets.py`,
not derived inline here -- see docs/stage-c-d-integration-plan.md §6.

No coastline dataset exists in this repo (only `data/infrastructure/platforms.geojson`
and `pipelines.geojson`), so `time_to_coastline_hours` and `time_to_sensitive_zone_hours`
are left `None` -- not computed, not "checked and found no crossing" (CLAUDE.md §70).
"""

from __future__ import annotations

from datetime import timedelta

from app.core.config import settings
from app.integrations.real.drift_physics import compute_backward_path, compute_forward_path
from app.integrations.real.forcing_data import load_current_parameters
from app.integrations.validation import validate_stage_result
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult

SYNTHETIC_FORCING_DISCLOSURE = (
    "Backward/forward drift computed via a deterministic Lagrangian particle-advection "
    "algorithm driven by an idealized, seeded synthetic current field -- not real "
    "oceanographic data (NOAA OSCAR/HYCOM/Copernicus). See "
    "docs/stage-c-d-integration-plan.md."
)


class RealDriftProvider:
    def get_result(self, case_id: str, detection: DetectionResult | None = None) -> DriftResult:
        if detection is None:
            raise ValueError(
                "RealDriftProvider.get_result() requires `detection`: a real drift "
                "engine seeds particles from the detected spill's centroid and "
                "timestamp, not from case_id alone. The orchestrator "
                "(investigation_service.py) always supplies this -- only a direct, "
                "standalone call would hit this error."
            )

        centroid = detection.spill.centroid
        detected_at = detection.detected_at
        forcing = load_current_parameters(case_id)

        backward = compute_backward_path(
            base_speed_mps=forcing.base_speed_mps,
            base_bearing_deg=forcing.base_bearing_deg,
            start_lat=centroid.lat,
            start_lon=centroid.lon,
            start_time=detected_at,
            hours=settings.drift_hindcast_hours,
            step_minutes=settings.drift_step_minutes,
        )
        forward = compute_forward_path(
            base_speed_mps=forcing.base_speed_mps,
            base_bearing_deg=forcing.base_bearing_deg,
            start_lat=centroid.lat,
            start_lon=centroid.lon,
            start_time=detected_at,
            hours=settings.drift_forecast_hours,
            step_minutes=settings.drift_step_minutes,
        )

        origin_time, origin_lat, origin_lon = backward[0]
        pad = timedelta(hours=settings.drift_origin_time_window_pad_hours)

        raw = {
            "case_id": case_id,
            "hindcast": {
                "origin": {"lat": origin_lat, "lon": origin_lon},
                "origin_time_window": {
                    "start": (origin_time - pad).isoformat(),
                    "end": (origin_time + pad).isoformat(),
                },
                "path": {
                    "type": "LineString",
                    "coordinates": [[lon, lat] for _, lat, lon in backward],
                },
                "origin_tolerance_km": round(
                    settings.drift_hindcast_hours * settings.drift_origin_tolerance_km_per_hour,
                    2,
                ),
            },
            "forecast": {
                "path": {
                    "type": "LineString",
                    "coordinates": [[lon, lat] for _, lat, lon in forward],
                },
                "time_to_coastline_hours": None,
                "time_to_sensitive_zone_hours": None,
            },
            "uncertainty": {
                "forcing_data": "synthetic_idealized",
                "disclosure": forcing.disclosure,
                "hindcast_hours": settings.drift_hindcast_hours,
                "forecast_hours": settings.drift_forecast_hours,
                "landfall_timing": "not computed -- no coastline dataset available in this repo",
            },
        }
        return validate_stage_result(DriftResult, raw, stage="C", case_id=case_id)
