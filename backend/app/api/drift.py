"""POST /api/drift (PRD §29) -- Stage C integration endpoint, mock-backed for MVP."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.integrations.stage_c import get_drift_provider
from app.schemas.drift import DriftResult

router = APIRouter(prefix="/api", tags=["drift"])


class DriftRequest(BaseModel):
    case_id: str


@router.post("/drift")
def drift(request: DriftRequest) -> DriftResult:
    return get_drift_provider().get_result(request.case_id)
