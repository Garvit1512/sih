"""InvestigationCase — the canonical aggregate the frontend consumes (PRD §8/§26).

Optional fields are explicitly nullable rather than defaulted to sentinel values, so the
frontend can distinguish "not yet computed" / "not applicable" from "zero" (PRD §70).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.attribution import AttributionResult
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult
from app.schemas.report import InvestigationReport
from app.schemas.triage import TriageResult


class CaseMeta(BaseModel):
    case_id: str
    name: str
    region: str
    date: str
    is_historical_ground_truth: bool


InvestigationStatus = Literal["pending", "running", "complete", "failed"]


class InvestigationCase(BaseModel):
    case_id: str
    case_meta: CaseMeta
    detection: DetectionResult | None = None
    triage: TriageResult | None = None
    drift: DriftResult | None = None
    attribution: AttributionResult | None = None
    report: InvestigationReport | None = None
    provenance: dict[str, str] = Field(default_factory=dict)
    status: InvestigationStatus = "pending"
    error: str | None = None
