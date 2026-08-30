"""POST /api/attribute (PRD §29). Runs Stage D only if Stage B routing allows it."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.paths import INFRASTRUCTURE_DIR
from app.data.infrastructure import load_infrastructure
from app.integrations.stage_c import get_drift_provider
from app.integrations.stage_d import get_attribution_provider
from app.schemas.attribution import AttributionResult
from app.services import triage_service

router = APIRouter(prefix="/api", tags=["attribution"])


class AttributeRequest(BaseModel):
    case_id: str


@router.post("/attribute")
def attribute(request: AttributeRequest) -> AttributionResult:
    drift = get_drift_provider().get_result(request.case_id)
    infrastructure = load_infrastructure(INFRASTRUCTURE_DIR)
    triage = triage_service.evaluate_triage(
        case_id=request.case_id,
        origin=drift.hindcast.origin,
        infrastructure=infrastructure,
        vessel_evidence_available=True,
        config=settings,
    )

    if not triage.routing.run_vessel_attribution:
        return AttributionResult(
            case_id=request.case_id,
            executed=False,
            reason="Stage B determined that vessel attribution is not applicable.",
        )

    result = get_attribution_provider().get_result(request.case_id)
    return result.model_copy(update={"low_confidence": triage.routing.low_confidence})
