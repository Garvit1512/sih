"""Stage B — Source-Type Triage engine (PRD §14-§22).

Deterministic, explainable, rule-based. No ML classifier (PRD §19/§66). Exists to
prevent the system from automatically blaming a vessel when the source may be
stationary (PRD §14.1).

Decision order (PRD §19, operationalized):
  1. Platform wins if it's within threshold AND (pipeline isn't nearby, or platform is
     at least as close as pipeline) -- this is the concrete reading of "platform
     evidence is stronger than competing source evidence."
  2. Otherwise pipeline wins if it's within threshold.
  3. Otherwise vessel, if vessel evidence is available.
  4. Otherwise insufficient-evidence.

`possible-natural-seep` stays in the frozen enum (PRD §18) but this engine never emits
it -- seep-zone detection is STRETCH scope (PRD §17.3), not implemented in MVP.
"""

from __future__ import annotations

from app.core.config import Settings
from app.data.infrastructure import (
    InfrastructureDataset,
    NearestFeature,
    nearest_pipeline,
    nearest_platform,
)
from app.schemas.common import Coordinate
from app.schemas.triage import (
    InfrastructureEvidence,
    TriageConfidence,
    TriageEvidence,
    TriageHypothesis,
    TriageResult,
    TriageRouting,
)


def evaluate_triage(
    case_id: str,
    origin: Coordinate,
    infrastructure: InfrastructureDataset,
    vessel_evidence_available: bool,
    config: Settings,
) -> TriageResult:
    nearest_plat = nearest_platform(origin, infrastructure.platforms)
    nearest_pipe = nearest_pipeline(origin, infrastructure.pipelines)

    platform_nearby = (
        nearest_plat.distance_km is not None
        and nearest_plat.distance_km <= config.triage_platform_radius_km
    )
    pipeline_nearby = (
        nearest_pipe.distance_km is not None
        and nearest_pipe.distance_km <= config.triage_pipeline_radius_km
    )

    platform_evidence_stronger = platform_nearby and (
        not pipeline_nearby or nearest_plat.distance_km <= nearest_pipe.distance_km
    )

    if platform_evidence_stronger:
        hypothesis = TriageHypothesis.LIKELY_PLATFORM
        confidence_tier = "High"
    elif pipeline_nearby:
        hypothesis = TriageHypothesis.LIKELY_PIPELINE
        confidence_tier = "High"
    elif vessel_evidence_available:
        hypothesis = TriageHypothesis.LIKELY_VESSEL
        confidence_tier = "Medium"
    else:
        hypothesis = TriageHypothesis.INSUFFICIENT_EVIDENCE
        confidence_tier = "Low"

    routing = TriageRouting(
        run_vessel_attribution=hypothesis
        in (TriageHypothesis.LIKELY_VESSEL, TriageHypothesis.INSUFFICIENT_EVIDENCE),
        low_confidence=hypothesis == TriageHypothesis.INSUFFICIENT_EVIDENCE,
    )

    evidence = TriageEvidence(
        platform=InfrastructureEvidence(
            nearby=platform_nearby,
            distance_km=nearest_plat.distance_km,
            id=nearest_plat.id,
            name=nearest_plat.name,
            location=nearest_plat.location,
        ),
        pipeline=InfrastructureEvidence(
            nearby=pipeline_nearby,
            distance_km=nearest_pipe.distance_km,
            id=nearest_pipe.id,
            name=nearest_pipe.name,
            location=None,
        ),
        vessel_evidence_available=vessel_evidence_available,
        narrative=_build_narrative(
            hypothesis, nearest_plat, nearest_pipe, vessel_evidence_available
        ),
    )

    return TriageResult(
        case_id=case_id,
        hypothesis=hypothesis,
        confidence=TriageConfidence(tier=confidence_tier),
        evidence=evidence,
        routing=routing,
    )


def _build_narrative(
    hypothesis: TriageHypothesis,
    nearest_plat: NearestFeature,
    nearest_pipe: NearestFeature,
    vessel_evidence_available: bool,
) -> list[str]:
    lines: list[str] = []

    if nearest_plat.distance_km is not None:
        lines.append(
            f"Estimated origin is {nearest_plat.distance_km:.1f} km from "
            f"platform {nearest_plat.name} ({nearest_plat.id})."
        )
    else:
        lines.append("No platform data is available for this region.")

    if nearest_pipe.distance_km is not None:
        lines.append(
            f"Nearest mapped pipeline ({nearest_pipe.name}, {nearest_pipe.id}) is "
            f"{nearest_pipe.distance_km:.1f} km away."
        )
    else:
        lines.append("No pipeline data is available for this region.")

    if hypothesis == TriageHypothesis.LIKELY_PLATFORM:
        lines.append("Stationary infrastructure provides stronger source evidence than "
                      "available vessel evidence.")
    elif hypothesis == TriageHypothesis.LIKELY_PIPELINE:
        lines.append("Pipeline proximity provides the strongest source evidence at this origin.")
    elif hypothesis == TriageHypothesis.LIKELY_VESSEL:
        lines.append("No stationary source is close enough to explain the origin; "
                      "vessel evidence is available.")
    elif hypothesis == TriageHypothesis.INSUFFICIENT_EVIDENCE:
        lines.append("No stationary source is close enough to explain the origin, and "
                      "no vessel evidence is available. This will be investigated as a "
                      "clearly labelled low-confidence lead.")

    lines.append(f"Vessel evidence available: {vessel_evidence_available}.")
    return lines
