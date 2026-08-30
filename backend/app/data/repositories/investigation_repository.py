"""In-memory investigation state store (PRD §61/§62 -- no DB required for MVP).

Known MVP tradeoff: state is cleared on backend restart. Low-risk because mock
providers are fully deterministic -- re-running POST /api/investigation/run after a
restart reproduces byte-identical results (see architecture audit plan §9).
"""

from __future__ import annotations

from app.schemas.investigation import InvestigationCase

_store: dict[str, InvestigationCase] = {}


def save(investigation: InvestigationCase) -> None:
    _store[investigation.case_id] = investigation


def get(case_id: str) -> InvestigationCase | None:
    return _store.get(case_id)
