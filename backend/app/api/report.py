"""POST /api/report/{case_id} (PRD §29).

Consumes an already-computed InvestigationCase -- never independently re-queries any
stage (PRD §26). Requires POST /api/investigation/run to have been called first.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import InvestigationNotFoundError
from app.schemas.report import InvestigationReport
from app.services import investigation_service

router = APIRouter(prefix="/api", tags=["report"])


@router.post("/report/{case_id}")
def generate_report(case_id: str) -> InvestigationReport:
    investigation = investigation_service.get_investigation(case_id)
    if investigation is None or investigation.report is None:
        raise InvestigationNotFoundError(
            f"No completed investigation exists for case '{case_id}'. "
            "Call POST /api/investigation/run first."
        )
    return investigation.report
