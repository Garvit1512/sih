"""Curated demo case registry (PRD §52). Deterministic, hand-verified metadata -- not
computed. Case 1 (OS-001) is the placeholder for the required real historical spill
(PRD §4.5/§59); its region/coordinates are provisional until a specific ITOPF/NOAA ERMA
case is selected in Phase 2 (see architecture audit plan §11.5) -- clearly marked below.
"""

from __future__ import annotations

from app.schemas.investigation import CaseMeta

DEMO_CASES: dict[str, CaseMeta] = {
    "OS-001": CaseMeta(
        case_id="OS-001",
        name="[PROVISIONAL] Historical Vessel-Source Case",
        region="Arabian Sea (placeholder region, pending real case selection)",
        date="2026-08-29",
        is_historical_ground_truth=True,
    ),
    "OS-002": CaseMeta(
        case_id="OS-002",
        name="Platform-Source Demo Case",
        region="Arabian Sea (synthetic demo region)",
        date="2026-08-29",
        is_historical_ground_truth=False,
    ),
    "OS-003": CaseMeta(
        case_id="OS-003",
        name="Pipeline-Source Demo Case",
        region="Arabian Sea (synthetic demo region)",
        date="2026-08-29",
        is_historical_ground_truth=False,
    ),
}


def list_cases() -> list[CaseMeta]:
    return list(DEMO_CASES.values())


def get_case(case_id: str) -> CaseMeta | None:
    return DEMO_CASES.get(case_id)
