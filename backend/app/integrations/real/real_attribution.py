"""Stage D real provider: a genuine proximity + trajectory-alignment scorer running
over a deterministic synthetic AIS scenario loaded from
`data/synthetic_ais/<case_id>/scenario.json` (docs/stage-c-d-integration-plan.md §7,
docs/staged-build-reference.md Stages 27-31). That file is generated once by
`backend/scripts/generate_synthetic_datasets.py` -- this provider does not generate a
scenario itself, it scores one that's already been persisted.

Synthetic AIS is the project's own approved demo design (CLAUDE.md §21), not a
shortcut -- the disclosure is carried on every result via `data_disclosure`. The
orchestrator (`investigation_service.py`) is the only caller and only invokes this when
Stage B's routing gate allows it; this class never decides that for itself.
"""

from __future__ import annotations

from app.core.config import settings
from app.integrations.real.ais_data import load_scenario
from app.integrations.real.attribution_scoring import (
    build_evidence,
    compute_drift_bearing,
    confidence_tier,
    filter_candidate,
    proximity_score,
    trajectory_alignment_score,
)
from app.integrations.validation import validate_stage_result
from app.schemas.attribution import AttributionResult
from app.schemas.drift import DriftResult

SYNTHETIC_AIS_DISCLOSURE = (
    "AIS tracks shown in this demonstration are synthetically generated for controlled "
    "validation and do not represent live vessel traffic."
)


class RealAttributionProvider:
    def get_result(self, case_id: str, drift: DriftResult | None = None) -> AttributionResult:
        if drift is None:
            raise ValueError(
                "RealAttributionProvider.get_result() requires `drift`: real candidate "
                "filtering and scoring needs the hindcast origin, time window, and "
                "backward path, not case_id alone. The orchestrator "
                "(investigation_service.py) always supplies this -- only a direct, "
                "standalone call would hit this error."
            )

        origin = drift.hindcast.origin
        window = drift.hindcast.origin_time_window
        drift_bearing = compute_drift_bearing(drift.hindcast.path)

        tracks = load_scenario(case_id)

        candidates_raw = []
        for track in tracks:
            filtered = filter_candidate(
                track,
                origin=origin,
                window=window,
                search_radius_km=settings.attribution_candidate_search_radius_km,
                pad_hours=settings.attribution_time_window_pad_hours,
            )
            if filtered is None:
                continue
            distance_km, closest_report = filtered

            proximity = proximity_score(
                distance_km, settings.attribution_candidate_search_radius_km
            )
            alignment = trajectory_alignment_score(closest_report.course_deg, drift_bearing)
            score = (
                settings.attribution_proximity_weight * proximity
                + settings.attribution_trajectory_weight * alignment
            )
            tier = confidence_tier(
                score,
                high_threshold=settings.attribution_high_confidence_threshold,
                medium_threshold=settings.attribution_medium_confidence_threshold,
            )
            candidates_raw.append(
                {
                    "vessel_id": track.vessel_id,
                    "vessel_name": track.vessel_name,
                    "score": round(score, 1),
                    "confidence_tier": tier,
                    "features": {
                        "proximity": round(proximity, 1),
                        "trajectory_alignment": round(alignment, 1),
                    },
                    "evidence": build_evidence(distance_km, alignment),
                }
            )

        candidates_raw.sort(key=lambda c: c["score"], reverse=True)

        raw = {
            "case_id": case_id,
            "executed": True,
            "reason": None,
            "data_disclosure": {
                "ais_type": "synthetic",
                "description": SYNTHETIC_AIS_DISCLOSURE,
            },
            "candidates": candidates_raw,
            "low_confidence": False,
        }
        return validate_stage_result(AttributionResult, raw, stage="D", case_id=case_id)
