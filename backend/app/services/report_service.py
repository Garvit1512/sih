"""Stage E -- Investigator's Dossier (PRD §23-§26).

Reporting layer only. Never performs new modelling, never recalculates drift, never
scores vessels -- it compiles already-computed stage results (PRD §65).
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.schemas.attribution import AttributionResult
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult
from app.schemas.investigation import CaseMeta
from app.schemas.report import SYNTHETIC_AIS_DISCLOSURE, CaseSummary, InvestigationReport
from app.schemas.triage import TriageResult


def generate(
    case_meta: CaseMeta,
    detection: DetectionResult,
    triage: TriageResult,
    drift: DriftResult,
    attribution: AttributionResult,
    provenance: dict[str, str],
) -> InvestigationReport:
    summary = CaseSummary(
        case_id=case_meta.case_id,
        name=case_meta.name,
        region=case_meta.region,
        investigation_timestamp=datetime.now(UTC).isoformat(),
        detection_timestamp=detection.detected_at.isoformat(),
    )

    # The mandated synthetic-AIS disclosure uses our own canonical wording (PRD §47,
    # CLAUDE.md §21) regardless of whatever description text Stage D's payload carries --
    # only shown when attribution actually ran against synthetic AIS.
    synthetic_ais_disclosure = None
    if attribution.executed and attribution.data_disclosure is not None:
        if attribution.data_disclosure.ais_type == "synthetic":
            synthetic_ais_disclosure = SYNTHETIC_AIS_DISCLOSURE

    return InvestigationReport(
        case_id=case_meta.case_id,
        summary=summary,
        detection=detection,
        source_hypothesis=triage,
        drift=drift,
        attribution=attribution,
        provenance=provenance,
        synthetic_ais_disclosure=synthetic_ais_disclosure,
    )
