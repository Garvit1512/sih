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


class ForecastResult(BaseModel):
    path: GeoJSONLineString
    time_to_coastline_hours: float | None = None
    time_to_sensitive_zone_hours: float | None = None


class DriftResult(BaseModel):
    case_id: str
    hindcast: HindcastResult
    forecast: ForecastResult
    uncertainty: dict | None = None
