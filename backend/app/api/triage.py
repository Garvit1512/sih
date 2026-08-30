"""POST /api/triage (PRD §29).

Simplification: accepts `{case_id}` and internally resolves the Stage C origin +
infrastructure dataset, rather than requiring the caller to pass a full DetectionResult
and origin -- the only origin the demo cases ever use is the one their own Stage C mock
produces. This keeps the endpoint a thin, testable wrapper around triage_service.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.paths import INFRASTRUCTURE_DIR
from app.data.infrastructure import load_infrastructure
from app.integrations.stage_c import get_drift_provider
from app.schemas.triage import TriageResult
from app.services import triage_service

router = APIRouter(prefix="/api", tags=["triage"])


class TriageRequest(BaseModel):
    case_id: str


@router.post("/triage")
def triage(request: TriageRequest) -> TriageResult:
    drift = get_drift_provider().get_result(request.case_id)
    infrastructure = load_infrastructure(INFRASTRUCTURE_DIR)
    return triage_service.evaluate_triage(
        case_id=request.case_id,
        origin=drift.hindcast.origin,
        infrastructure=infrastructure,
        vessel_evidence_available=True,
        config=settings,
    )
