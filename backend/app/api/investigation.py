from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.errors import InvestigationNotFoundError
from app.schemas.investigation import InvestigationCase
from app.services import investigation_service

router = APIRouter(prefix="/api/investigation", tags=["investigation"])


class RunInvestigationRequest(BaseModel):
    case_id: str


@router.post("/run")
def run_investigation(request: RunInvestigationRequest) -> InvestigationCase:
    return investigation_service.run_investigation(request.case_id)


@router.get("/{case_id}")
def get_investigation(case_id: str) -> InvestigationCase:
    investigation = investigation_service.get_investigation(case_id)
    if investigation is None:
        raise InvestigationNotFoundError(
            f"No investigation has been run yet for case '{case_id}'."
        )
    return investigation
