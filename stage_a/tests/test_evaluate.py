"""Stage 10 tests — the metric arithmetic, and the honesty rules around it.

These numbers end up on the evaluation slide. A metric that is wrong in the flattering
direction is the most expensive defect in this repository, so the arithmetic is checked
against hand-computed values rather than against itself.
"""

from __future__ import annotations

import numpy as np
import pytest

from stage_a.config import CLASS_NAMES
from stage_a.evaluate import ConfusionAccumulator


def test_perfect_prediction_scores_one():
    targets = np.array([[0, 1], [2, 3]])
    accumulator = ConfusionAccumulator()
    accumulator.update(targets.copy(), targets)

    report = accumulator.compute()
    defined = [m for m in report.per_class if m.is_defined]

    assert all(m.iou == pytest.approx(1.0) for m in defined)
    assert report.mean_iou == pytest.approx(1.0)


def test_iou_matches_hand_computed_value():
    # Ground truth: 4 oil pixels. Prediction: 2 of them correct, plus 1 false positive.
    # TP=2, FN=2, FP=1  ->  IoU = 2/5 = 0.4,  Dice = 4/(4+1+2) = 0.5714...
    targets = np.array([1, 1, 1, 1, 0])
    predictions = np.array([1, 1, 0, 0, 1])

    accumulator = ConfusionAccumulator()
    accumulator.update(predictions, targets)
    oil = next(m for m in accumulator.compute().per_class if m.name == "oil_spill")

    assert oil.iou == pytest.approx(0.4)
    assert oil.dice == pytest.approx(4 / 7)


def test_absent_class_is_undefined_not_zero():
    """A class in neither ground truth nor predictions must not be scored."""
    targets = np.array([0, 0, 1, 1])
    predictions = np.array([0, 0, 1, 1])

    accumulator = ConfusionAccumulator()
    accumulator.update(predictions, targets)
    report = accumulator.compute()

    ship = next(m for m in report.per_class if m.name == "ship")
    assert ship.iou is None, "absent class must be undefined, not 0.0 or 1.0"
    assert ship.dice is None


def test_mean_excludes_undefined_classes_and_says_so():
    targets = np.array([0, 0, 1, 1])
    predictions = np.array([0, 0, 1, 1])

    accumulator = ConfusionAccumulator()
    accumulator.update(predictions, targets)
    report = accumulator.compute()

    assert report.classes_in_mean == 2
    assert report.mean_iou == pytest.approx(1.0)
    assert "2 of 5 classes" in report.render()


def test_predicting_only_the_majority_class_is_visibly_punished():
    """The failure this project must not ship: 'sea surface everywhere' looking good."""
    targets = np.zeros(100, dtype=np.int64)
    targets[:5] = 1  # 5% oil spill, a realistic minority share
    predictions = np.zeros(100, dtype=np.int64)  # predicts sea surface everywhere

    accumulator = ConfusionAccumulator()
    accumulator.update(predictions, targets)
    report = accumulator.compute()

    oil = next(m for m in report.per_class if m.name == "oil_spill")
    assert oil.iou == pytest.approx(0.0), "missing every oil pixel must score 0, not be excluded"
    assert report.mean_iou < 0.6, "the mean must reflect the failure, not hide it"


def test_class_distribution_is_reported_alongside_metrics():
    targets = np.zeros(100, dtype=np.int64)
    targets[:20] = 1

    accumulator = ConfusionAccumulator()
    accumulator.update(targets.copy(), targets)
    report = accumulator.compute()

    assert report.class_distribution["oil_spill"] == pytest.approx(0.2)
    assert report.class_distribution["sea_surface"] == pytest.approx(0.8)
    assert "% of pixels" in report.render()


def test_accumulates_across_multiple_images():
    accumulator = ConfusionAccumulator()
    for _ in range(3):
        accumulator.update(np.array([0, 1]), np.array([0, 1]))

    report = accumulator.compute()
    assert report.num_images == 3
    assert report.total_pixels == 6


def test_shape_mismatch_is_rejected():
    accumulator = ConfusionAccumulator()
    with pytest.raises(ValueError):
        accumulator.update(np.zeros((4, 4)), np.zeros((8, 8)))


def test_report_round_trips_through_json(tmp_path):
    accumulator = ConfusionAccumulator()
    accumulator.update(np.array([0, 1]), np.array([0, 1]))
    report = accumulator.compute()

    path = tmp_path / "metrics.json"
    report.save(path)

    import json

    payload = json.loads(path.read_text(encoding="utf-8"))
    assert payload["classes_in_mean"] == 2
    assert len(payload["per_class"]) == len(CLASS_NAMES)
