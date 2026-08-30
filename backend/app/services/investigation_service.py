"""Investigation orchestrator (PRD §30).

load case -> Stage A -> Stage C -> Stage B -> conditional Stage D -> Stage E -> aggregate.

Approved behavior for `insufficient-evidence`: Stage D auto-runs, clearly labelled
low-confidence via `AttributionResult.low_confidence` (see architecture audit plan
§0/§9 -- resolved with the user before implementation).
"""

from __future__ import annotations

from app.core.config import Settings, settings
from app.core.paths import INFRASTRUCTURE_DIR
from app.data.infrastructure import load_infrastructure
from app.data.repositories import investigation_repository
from app.integrations.base import AttributionProvider, DetectionProvider, DriftProvider
from app.integrations.stage_a import get_detection_provider
from app.integrations.stage_c import get_drift_provider
from app.integrations.stage_d import get_attribution_provider
from app.schemas.attribution import AttributionResult
from app.schemas.investigation import CaseMeta, InvestigationCase
from app.services import case_service, report_service, triage_service


def run_investigation(
    case_id: str,
    detection_provider: DetectionProvider | None = None,
    drift_provider: DriftProvider | None = None,
    attribution_provider: AttributionProvider | None = None,
    config: Settings = settings,
) -> InvestigationCase:
    case_meta: CaseMeta = case_service.get_case_or_raise(case_id)

    detection_provider = detection_provider or get_detection_provider()
    drift_provider = drift_provider or get_drift_provider()
    attribution_provider = attribution_provider or get_attribution_provider()

    detection = detection_provider.get_result(case_id)
    drift = drift_provider.get_result(case_id)

    infrastructure = load_infrastructure(INFRASTRUCTURE_DIR)
    triage = triage_service.evaluate_triage(
        case_id=case_id,
        origin=drift.hindcast.origin,
        infrastructure=infrastructure,
        vessel_evidence_available=True,  # MVP: always true, see plan §9
        config=config,
    )

    if triage.routing.run_vessel_attribution:
        attribution = attribution_provider.get_result(case_id)
        attribution = attribution.model_copy(
            update={"low_confidence": triage.routing.low_confidence}
        )
    else:
        attribution = AttributionResult(
            case_id=case_id,
            executed=False,
            reason="Stage B determined that vessel attribution is not applicable.",
        )

    provenance = {
        "detection": f"stage-a-{config.stage_a_mode}",
        "drift": f"stage-c-{config.stage_c_mode}",
        "triage": "stage-b-rule-engine",
        "attribution": f"stage-d-{config.stage_d_mode}" if attribution.executed else "not-run",
        "infrastructure": "hand-verified-static-dataset",
    }

    report = report_service.generate(
        case_meta=case_meta,
        detection=detection,
        triage=triage,
        drift=drift,
        attribution=attribution,
        provenance=provenance,
    )

    investigation = InvestigationCase(
        case_id=case_id,
        case_meta=case_meta,
        detection=detection,
        triage=triage,
        drift=drift,
        attribution=attribution,
        report=report,
        provenance=provenance,
        status="complete",
    )
    investigation_repository.save(investigation)
    return investigation


def get_investigation(case_id: str) -> InvestigationCase | None:
    return investigation_repository.get(case_id)
