from __future__ import annotations

from fastapi import APIRouter

from app.schemas.investigation import CaseMeta
from app.services import case_service

router = APIRouter(prefix="/api", tags=["cases"])


@router.get("/cases")
def get_cases() -> dict[str, list[CaseMeta]]:
    return {"cases": case_service.get_all_cases()}


@router.get("/cases/{case_id}")
def get_case(case_id: str) -> CaseMeta:
    return case_service.get_case_or_raise(case_id)
