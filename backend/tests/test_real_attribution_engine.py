"""RealAttributionProvider (docs/stage-c-d-integration-plan.md §6): a genuine
proximity + trajectory-alignment scorer over a deterministic synthetic AIS scenario.
Verifies schema-valid, internally-consistent, deterministic output, and that the
planted vessel (built on-course with the drift bearing, close to the origin) outranks
background traffic -- the actual claim a "real" scorer needs to substantiate, unlike a
fixture lookup which just asserts it by construction."""

from __future__ import annotations

import json

import pytest

from app.core.config import Settings
from app.core.paths import CASES_DIR
from app.integrations.real.real_attribution import RealAttributionProvider
from app.schemas.drift import DriftResult


def _load_drift(case_id: str) -> DriftResult:
    with (CASES_DIR / case_id / "drift.json").open(encoding="utf-8") as f:
        return DriftResult.model_validate(json.load(f))


@pytest.mark.parametrize("case_id", ["OS-001", "OS-002", "OS-003", "OS-004"])
def test_real_attribution_provider_produces_valid_result(case_id: str):
    drift = _load_drift(case_id)
    result = RealAttributionProvider().get_result(case_id, drift=drift)

    assert result.case_id == case_id
    assert result.executed is True
    assert result.data_disclosure is not None
    assert result.data_disclosure.ais_type == "synthetic"
    assert "synthetic" in result.data_disclosure.description.lower()

    # At least the planted vessel must survive space-time filtering, by construction
    # (it's built within the search radius and time window every time).
    assert len(result.candidates) >= 1

    scores = [c.score for c in result.candidates]
    assert scores == sorted(scores, reverse=True)

    settings = Settings()
    for candidate in result.candidates:
        if candidate.score >= settings.attribution_high_confidence_threshold:
            assert candidate.confidence_tier == "High"
        elif candidate.score >= settings.attribution_medium_confidence_threshold:
            assert candidate.confidence_tier == "Medium"
        else:
            assert candidate.confidence_tier == "Low"
        assert len(candidate.evidence) == 2


def test_real_attribution_provider_ranks_the_planted_vessel_first():
    # The planted vessel is built on-course with the drift bearing and within 4 km of
    # the origin; background traffic is built off-course and 25-110 km away. It should
    # win on both feature scores, and therefore rank first.
    drift = _load_drift("OS-001")
    result = RealAttributionProvider().get_result("OS-001", drift=drift)
    top = result.candidates[0]
    assert top.features.proximity > 50.0
    assert top.features.trajectory_alignment > 50.0


def test_real_attribution_provider_is_deterministic():
    drift = _load_drift("OS-001")
    first = RealAttributionProvider().get_result("OS-001", drift=drift)
    second = RealAttributionProvider().get_result("OS-001", drift=drift)
    assert first.model_dump() == second.model_dump()
