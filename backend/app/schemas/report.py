"""Stage E contract — InvestigationReport.

Stage E is a reporting layer only (PRD §23/§65) — this schema is filled from already
computed stage results, never independently inferred. The disclaimer is typed as the
exact required literal so it cannot be silently reworded (PRD §1/§20).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.attribution import AttributionResult
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult
from app.schemas.triage import TriageResult

DISCLAIMER: Literal["this is a decision-support lead list, not a legal determination."] = (
    "this is a decision-support lead list, not a legal determination."
)

SYNTHETIC_AIS_DISCLOSURE = (
    "AIS tracks shown in this demonstration are synthetically generated for controlled "
    "validation and do not represent live vessel traffic."
)

KNOWN_LIMITATIONS: list[str] = [
    "AIS data in the demo is synthetic.",
    "Stage A confidence is indicative and uncalibrated.",
    "Public infrastructure datasets may have incomplete coverage.",
    "MVP vessel attribution relies on proximity and trajectory.",
    "AIS dark gaps can reduce attribution effectiveness in the real world.",
    "Drift validation may be based on a limited number of historical cases (n=1).",
    "System output is an investigative lead, not a legal conclusion.",
]


class CaseSummary(BaseModel):
    case_id: str
    name: str
    region: str
    investigation_timestamp: str
    detection_timestamp: str


class InvestigationReport(BaseModel):
    case_id: str
    summary: CaseSummary
    detection: DetectionResult
    source_hypothesis: TriageResult
    drift: DriftResult
    attribution: AttributionResult
    provenance: dict[str, str]
    limitations: list[str] = Field(default_factory=lambda: list(KNOWN_LIMITATIONS))
    synthetic_ais_disclosure: str | None = None
    disclaimer: Literal["this is a decision-support lead list, not a legal determination."] = (
        DISCLAIMER
    )
