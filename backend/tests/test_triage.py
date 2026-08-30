"""Stage B unit tests (PRD §49)."""

from __future__ import annotations

from shapely.geometry import LineString

from app.core.config import Settings
from app.data.infrastructure import InfrastructureDataset, PipelineFeature, PlatformFeature
from app.schemas.common import Coordinate
from app.schemas.triage import TriageHypothesis
from app.services.triage_service import evaluate_triage

CONFIG = Settings(triage_platform_radius_km=5.0, triage_pipeline_radius_km=2.0)

PLATFORM = PlatformFeature(
    id="P-1", name="Platform One", location=Coordinate(lat=15.025, lon=66.910)
)
PIPELINE = PipelineFeature(
    id="PL-1",
    name="Pipeline One",
    geometry=LineString([(68.050, 14.400), (68.050, 14.800)]),
)

DATASET = InfrastructureDataset(platforms=[PLATFORM], pipelines=[PIPELINE])
EMPTY_DATASET = InfrastructureDataset(platforms=[], pipelines=[])


def test_platform_positive_within_threshold():
    origin = Coordinate(lat=15.010, lon=66.910)  # ~1.7 km from PLATFORM
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.evidence.platform.nearby is True
    assert result.hypothesis == TriageHypothesis.LIKELY_PLATFORM
    assert result.routing.run_vessel_attribution is False


def test_platform_negative_outside_threshold():
    origin = Coordinate(lat=10.000, lon=60.000)  # far from PLATFORM
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.evidence.platform.nearby is False


def test_pipeline_positive_within_threshold():
    origin = Coordinate(lat=14.600, lon=68.064)  # ~1.5 km from PIPELINE, far from PLATFORM
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.evidence.pipeline.nearby is True
    assert result.hypothesis == TriageHypothesis.LIKELY_PIPELINE
    assert result.routing.run_vessel_attribution is False


def test_vessel_routing_when_no_stationary_source():
    origin = Coordinate(lat=0.0, lon=0.0)  # far from everything
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.hypothesis == TriageHypothesis.LIKELY_VESSEL
    assert result.routing.run_vessel_attribution is True
    assert result.routing.low_confidence is False


def test_platform_routing_blocks_stage_d():
    origin = Coordinate(lat=15.010, lon=66.910)
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.hypothesis == TriageHypothesis.LIKELY_PLATFORM
    assert result.routing.run_vessel_attribution is False


def test_pipeline_routing_blocks_stage_d():
    origin = Coordinate(lat=14.600, lon=68.064)
    result = evaluate_triage("t", origin, DATASET, vessel_evidence_available=True, config=CONFIG)
    assert result.hypothesis == TriageHypothesis.LIKELY_PIPELINE
    assert result.routing.run_vessel_attribution is False


def test_insufficient_evidence_when_no_source_at_all():
    origin = Coordinate(lat=0.0, lon=0.0)
    result = evaluate_triage(
        "t", origin, EMPTY_DATASET, vessel_evidence_available=False, config=CONFIG
    )
    assert result.hypothesis == TriageHypothesis.INSUFFICIENT_EVIDENCE
    assert result.routing.run_vessel_attribution is True
    assert result.routing.low_confidence is True


def test_platform_wins_when_both_nearby_but_platform_is_closer():
    # Both platform and pipeline within their own thresholds; platform is the closer of
    # the two, so it should win the "stronger evidence" tie-break.
    nearby_pipeline = PipelineFeature(
        id="PL-2",
        name="Pipeline Two",
        geometry=LineString([(66.930, 15.000), (66.930, 15.040)]),
    )
    dataset = InfrastructureDataset(platforms=[PLATFORM], pipelines=[nearby_pipeline])
    origin = Coordinate(lat=15.020, lon=66.912)  # ~0.6 km from platform, ~1.9 km from pipeline
    result = evaluate_triage("t", origin, dataset, vessel_evidence_available=True, config=CONFIG)
    assert result.evidence.platform.nearby is True
    assert result.evidence.pipeline.nearby is True
    assert result.hypothesis == TriageHypothesis.LIKELY_PLATFORM
