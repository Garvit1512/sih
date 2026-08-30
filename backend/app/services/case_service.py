from __future__ import annotations

from app.core.errors import CaseNotFoundError
from app.data.demo_cases import get_case, list_cases
from app.schemas.investigation import CaseMeta


def get_all_cases() -> list[CaseMeta]:
    return list_cases()


def get_case_or_raise(case_id: str) -> CaseMeta:
    case = get_case(case_id)
    if case is None:
        raise CaseNotFoundError(f"Case '{case_id}' was not found.")
    return case
