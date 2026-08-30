"""Geo/time contract primitives shared across every frozen cross-stage schema.

Canonical CRS is WGS84 / EPSG:4326. API coordinate objects are always {lat, lon};
GeoJSON geometries always carry [lon, lat] per the GeoJSON spec. `Coordinate` is the
single place the two representations meet, so an ordering bug can only be introduced
here (see backend/tests/test_contracts.py for the regression test).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)

    def to_geojson_point(self) -> dict:
        return {"type": "Point", "coordinates": [self.lon, self.lat]}


def require_utc(value: datetime) -> datetime:
    """Reject naive or non-UTC timestamps at the API boundary (PRD §10)."""
    if value.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware (UTC); received a naive datetime")
    if value.utcoffset() != UTC.utcoffset(value):
        raise ValueError("timestamp must be UTC (offset +00:00)")
    return value


class TimeWindow(BaseModel):
    start: datetime
    end: datetime

    @field_validator("start", "end")
    @classmethod
    def _validate_utc(cls, value: datetime) -> datetime:
        return require_utc(value)


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float]


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]


class GeoJSONLineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]
