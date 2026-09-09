"""Stage 8 tests — the score must discriminate, and must stay uncalibrated in wording."""

from __future__ import annotations

import numpy as np
import pytest

from stage_a.confidence import CONFIDENCE_LABEL, CONFIDENCE_TYPE, extract_confidence
from stage_a.config import LOOK_ALIKE_CLASS, NUM_CLASSES, OIL_SPILL_CLASS


def _probabilities(oil: float, look_alike: float, shape=(16, 16)) -> np.ndarray:
    probs = np.zeros((NUM_CLASSES, *shape), dtype=np.float32)
    probs[OIL_SPILL_CLASS] = oil
    probs[LOOK_ALIKE_CLASS] = look_alike
    remainder = max(0.0, 1.0 - oil - look_alike)
    probs[0] = remainder
    return probs


def _mask_with_detection(shape=(16, 16), region=slice(4, 12)) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    mask[region, region] = OIL_SPILL_CLASS
    return mask


def test_confident_oil_detection_scores_high():
    result = extract_confidence(_probabilities(oil=0.9, look_alike=0.05), _mask_with_detection())

    assert result is not None
    assert result.value > 0.9


def test_ambiguous_detection_scores_near_the_midpoint():
    """Oil and look-alike activating equally is the definition of an ambiguous call."""
    result = extract_confidence(_probabilities(oil=0.45, look_alike=0.45), _mask_with_detection())

    assert result is not None
    assert result.value == pytest.approx(0.5, abs=0.02)


def test_score_visibly_discriminates_between_clear_and_ambiguous():
    """Stage 8's human decision gate asks exactly this question."""
    clear = extract_confidence(_probabilities(oil=0.92, look_alike=0.03), _mask_with_detection())
    ambiguous = extract_confidence(_probabilities(oil=0.5, look_alike=0.42), _mask_with_detection())

    assert clear.value - ambiguous.value > 0.3


def test_no_detection_returns_none_not_zero():
    """A zero would read downstream as 'detected, no confidence' — a different claim."""
    empty_mask = np.zeros((16, 16), dtype=np.uint8)

    assert extract_confidence(_probabilities(oil=0.9, look_alike=0.05), empty_mask) is None


def test_contract_shape_carries_the_uncalibrated_marking():
    result = extract_confidence(_probabilities(oil=0.8, look_alike=0.1), _mask_with_detection())
    payload = result.to_contract()

    assert payload["type"] == CONFIDENCE_TYPE == "indicative_uncalibrated"
    assert payload["label"] == CONFIDENCE_LABEL
    assert 0.0 <= payload["value"] <= 1.0


def test_evidence_lines_avoid_calibrated_probability_language():
    """CLAUDE.md §23: never render this as '87% probability of oil'."""
    result = extract_confidence(_probabilities(oil=0.87, look_alike=0.05), _mask_with_detection())

    text = " ".join(result.evidence_lines()).lower()
    assert "indicative" in text
    assert "%" not in text
    assert "probability this is" not in text


def test_components_are_retained_for_the_evidence_breakdown():
    result = extract_confidence(_probabilities(oil=0.8, look_alike=0.15), _mask_with_detection())

    assert result.mean_oil_probability == pytest.approx(0.8, abs=0.01)
    assert result.mean_look_alike_probability == pytest.approx(0.15, abs=0.01)
    assert result.detected_pixel_count == 64


def test_shape_mismatch_is_rejected_rather_than_broadcast():
    probs = _probabilities(oil=0.8, look_alike=0.1, shape=(16, 16))
    wrong_mask = np.zeros((8, 8), dtype=np.uint8)

    with pytest.raises(ValueError):
        extract_confidence(probs, wrong_mask)
