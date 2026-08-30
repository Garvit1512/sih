"""Stage B contract — TriageResult (source-type triage).

Frozen per PRD §18-§22. This is our own stage; the enum, evidence shape, and routing
decision are the contract the frontend and Stage E consume.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import Coordinate


class TriageHypothesis(StrEnum):
    LIKELY_VESSEL = "likely-vessel"
    LIKELY_PLATFORM = "likely-platform"
    LIKELY_PIPELINE = "likely-pipeline"
    POSSIBLE_NATURAL_SEEP = "possible-natural-seep"
    INSUFFICIENT_EVIDENCE = "insufficient-evidence"


class TriageConfidence(BaseModel):
    tier: Literal["High", "Medium", "Low"]
    value: float | None = None
    type: Literal["rule_based"] = "rule_based"


class InfrastructureEvidence(BaseModel):
    nearby: bool
    distance_km: float | None
    id: str | None
    name: str | None
    location: Coordinate | None = None


class TriageEvidence(BaseModel):
    platform: InfrastructureEvidence
    pipeline: InfrastructureEvidence
    vessel_evidence_available: bool
    narrative: list[str]


class TriageRouting(BaseModel):
    run_vessel_attribution: bool
    low_confidence: bool = False


class TriageResult(BaseModel):
    case_id: str
    hypothesis: TriageHypothesis
    confidence: TriageConfidence
    evidence: TriageEvidence
    routing: TriageRouting
