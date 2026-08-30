"""Stage A contract — DetectionResult.

Frozen per PRD §11. Stage A internals (SAR segmentation) are owned by another team
member; this schema is the boundary they must adapt their real output to.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Coordinate, GeoJSONPolygon, require_utc


class DetectionConfidence(BaseModel):
    value: float = Field(ge=0, le=1)
    type: Literal["indicative_uncalibrated"] = "indicative_uncalibrated"
    label: str = "Indicative detection confidence"


class SpillGeometry(BaseModel):
    centroid: Coordinate
    polygon: GeoJSONPolygon
    area_km2: float = Field(ge=0)
    perimeter_km: float = Field(ge=0)
    elongation: float = Field(ge=0)
    coastline_distance_km: float | None = None


class DetectionResult(BaseModel):
    case_id: str
    detected_at: datetime
    spill: SpillGeometry
    detection_confidence: DetectionConfidence

    @field_validator("detected_at")
    @classmethod
    def _validate_utc(cls, value: datetime) -> datetime:
        return require_utc(value)
