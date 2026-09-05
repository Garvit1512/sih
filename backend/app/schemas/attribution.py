"""Stage D contract — AttributionResult.

Frozen per PRD §13. Stage D internals (AIS vessel scoring) are owned by another team
member; this schema is the boundary they must adapt their real output to.

`low_confidence` is an additive field beyond the PRD §13 example, needed to implement
the approved behavior for `insufficient-evidence` routing (auto-run Stage D, but clearly
labelled low-confidence). See docs/decisions.md #2-#3.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class VesselFeatures(BaseModel):
    proximity: float = Field(ge=0, le=100)
    trajectory_alignment: float = Field(ge=0, le=100)


class VesselCandidate(BaseModel):
    vessel_id: str
    vessel_name: str | None = None
    score: float = Field(ge=0, le=100)
    confidence_tier: Literal["High", "Medium", "Low"]
    features: VesselFeatures
    evidence: list[str]


class DataDisclosure(BaseModel):
    ais_type: Literal["synthetic", "real"]
    description: str


class AttributionResult(BaseModel):
    case_id: str
    executed: bool
    reason: str | None = None
    data_disclosure: DataDisclosure | None = None
    candidates: list[VesselCandidate] = Field(default_factory=list)
    low_confidence: bool = False
