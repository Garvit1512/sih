"""Stage C contract — DriftResult.

Frozen per PRD §12. Stage C internals (OpenDrift/OpenOil) are owned by another team
member; this schema is the boundary they must adapt their real output to.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import Coordinate, GeoJSONLineString, TimeWindow


class HindcastResult(BaseModel):
    origin: Coordinate
    origin_time_window: TimeWindow
    path: GeoJSONLineString
    origin_tolerance_km: float | None = None
    """Spatial uncertainty radius around `origin`, in kilometres. `None` means the
    provider did not report one (true of every current mock fixture). Additive per
    docs/stage-c-d-integration-plan.md §4.1 -- not yet consumed by triage_service.py or
    any mock fixture; adding that is a separate, deliberate change once a real Stage C
    provider actually populates it."""


class ForecastResult(BaseModel):
    path: GeoJSONLineString
    time_to_coastline_hours: float | None = None
    time_to_sensitive_zone_hours: float | None = None


class DriftResult(BaseModel):
    case_id: str
    hindcast: HindcastResult
    forecast: ForecastResult
    uncertainty: dict | None = None
