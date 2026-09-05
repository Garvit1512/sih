"""Curated demo case registry (PRD §52). Deterministic, hand-verified metadata -- not
computed. Case 1 (OS-001) is the placeholder for the required real historical spill
(PRD §4.5/§59); its region/coordinates are provisional until a specific ITOPF/NOAA ERMA
case is selected (see docs/decisions.md #9) -- clearly marked below.
"""

from __future__ import annotations

from app.core.errors import CaseNotFoundError
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
    "OS-004": CaseMeta(
        case_id="OS-004",
        name="Insufficient-Evidence Demo Case",
        region="Arabian Sea (synthetic demo region)",
        date="2026-08-29",
        is_historical_ground_truth=False,
    ),
}


def list_cases() -> list[CaseMeta]:
    return list(DEMO_CASES.values())


def get_case(case_id: str) -> CaseMeta | None:
    return DEMO_CASES.get(case_id)


# Per-case Stage B input: whether vessel evidence is available for this case's region
# and time window. Internal orchestration data only -- never a public schema field (see
# docs/decisions.md #2). One source of truth, consumed by every call site that invokes
# triage_service.evaluate_triage() instead of each hardcoding its own value.
_VESSEL_EVIDENCE_AVAILABLE: dict[str, bool] = {
    "OS-001": True,
    "OS-002": True,
    "OS-003": True,
    "OS-004": False,
}


def vessel_evidence_available_for(case_id: str) -> bool:
    if case_id not in _VESSEL_EVIDENCE_AVAILABLE:
        raise CaseNotFoundError(
            f"No vessel-evidence-availability configured for case '{case_id}'."
        )
    return _VESSEL_EVIDENCE_AVAILABLE[case_id]
