"""Stage 10 — detection evaluation harness.

Reports per-class and mean IoU and Dice on the corpus's official held-out test split,
alongside the class distribution, because a mean computed over five classes of wildly
different frequency is unreadable without it.

Honesty rules encoded here rather than left to the person writing the slide:

* A class with no ground-truth pixels *and* no predictions has undefined IoU. This
  module reports `None`, never 0.0 and never 1.0 — the first understates the model and
  the second is a free point for correctly predicting nothing (CLAUDE.md §60, §70).
* The mean is computed over defined classes only, and the report states how many classes
  it covers, so a mean over four classes is never mistaken for a mean over five.
* Nothing here estimates. If a metric was not computed, it is absent, not guessed.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from stage_a.config import CLASS_NAMES, NUM_CLASSES


@dataclass
class ClassMetrics:
    name: str
    iou: float | None
    dice: float | None
    support_pixels: int
    predicted_pixels: int

    @property
    def is_defined(self) -> bool:
        return self.iou is not None


@dataclass
class EvaluationReport:
    per_class: list[ClassMetrics]
    mean_iou: float | None
    mean_dice: float | None
    classes_in_mean: int
    class_distribution: dict[str, float]
    total_pixels: int
    num_images: int

    def to_dict(self) -> dict:
        return {
            "per_class": [asdict(m) for m in self.per_class],
            "mean_iou": self.mean_iou,
            "mean_dice": self.mean_dice,
            "classes_in_mean": self.classes_in_mean,
            "class_distribution": self.class_distribution,
            "total_pixels": self.total_pixels,
            "num_images": self.num_images,
        }

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")

    def render(self) -> str:
        """A plain-text table suitable for pasting into the Stage 53 evaluation section."""
        lines = [
            f"Detection evaluation — {self.num_images} images, {self.total_pixels:,} pixels",
            "",
            f"{'class':<14}{'IoU':>10}{'Dice':>10}{'% of pixels':>14}",
            "-" * 48,
        ]
        for metric in self.per_class:
            iou = f"{metric.iou:.4f}" if metric.iou is not None else "n/a"
            dice = f"{metric.dice:.4f}" if metric.dice is not None else "n/a"
            share = self.class_distribution.get(metric.name, 0.0) * 100
            lines.append(f"{metric.name:<14}{iou:>10}{dice:>10}{share:>13.2f}%")

        lines.append("-" * 48)
        mean_iou = f"{self.mean_iou:.4f}" if self.mean_iou is not None else "n/a"
        mean_dice = f"{self.mean_dice:.4f}" if self.mean_dice is not None else "n/a"
        lines.append(f"{'mean':<14}{mean_iou:>10}{mean_dice:>10}")
        lines.append("")
        lines.append(
            f"Mean is over {self.classes_in_mean} of {NUM_CLASSES} classes "
            "(classes absent from both predictions and ground truth are excluded as undefined)."
        )
        return "\n".join(lines)


class ConfusionAccumulator:
    """Streaming confusion matrix, so evaluation never holds the whole split in memory."""

    def __init__(self, num_classes: int = NUM_CLASSES) -> None:
        self.num_classes = num_classes
        self.matrix = np.zeros((num_classes, num_classes), dtype=np.int64)
        self.num_images = 0

    def update(self, predictions: np.ndarray, targets: np.ndarray) -> None:
        if predictions.shape != targets.shape:
            raise ValueError(
                f"prediction shape {predictions.shape} does not match target {targets.shape}"
            )

        valid = (targets >= 0) & (targets < self.num_classes)
        flat_targets = targets[valid].astype(np.int64)
        flat_predictions = predictions[valid].astype(np.int64)
        indices = flat_targets * self.num_classes + flat_predictions
        self.matrix += np.bincount(indices, minlength=self.num_classes**2).reshape(
            self.num_classes, self.num_classes
        )
        # `evaluate_model`/`train._validate` pass whole (N, H, W) batches, not one (H, W)
        # image per call — count the images actually in this call, not the calls themselves.
        self.num_images += predictions.shape[0] if predictions.ndim == 3 else 1

    def compute(self) -> EvaluationReport:
        true_positive = np.diag(self.matrix).astype(np.float64)
        support = self.matrix.sum(axis=1).astype(np.float64)   # ground-truth pixels per class
        predicted = self.matrix.sum(axis=0).astype(np.float64)  # predicted pixels per class

        false_positive = predicted - true_positive
        false_negative = support - true_positive

        per_class: list[ClassMetrics] = []
        ious: list[float] = []
        dices: list[float] = []

        for index, name in enumerate(CLASS_NAMES[: self.num_classes]):
            union = true_positive[index] + false_positive[index] + false_negative[index]
            if union == 0:
                # Absent from both ground truth and predictions: undefined, not zero.
                per_class.append(
                    ClassMetrics(
                        name=name,
                        iou=None,
                        dice=None,
                        support_pixels=int(support[index]),
                        predicted_pixels=int(predicted[index]),
                    )
                )
                continue

            iou = float(true_positive[index] / union)
            dice_denominator = (
                2 * true_positive[index] + false_positive[index] + false_negative[index]
            )
            dice = float(2 * true_positive[index] / dice_denominator) if dice_denominator else 0.0

            ious.append(iou)
            dices.append(dice)
            per_class.append(
                ClassMetrics(
                    name=name,
                    iou=iou,
                    dice=dice,
                    support_pixels=int(support[index]),
                    predicted_pixels=int(predicted[index]),
                )
            )

        total = float(self.matrix.sum())
        names = CLASS_NAMES[: self.num_classes]
        distribution = (
            {name: float(support[i] / total) for i, name in enumerate(names)} if total else {}
        )

        return EvaluationReport(
            per_class=per_class,
            mean_iou=float(np.mean(ious)) if ious else None,
            mean_dice=float(np.mean(dices)) if dices else None,
            classes_in_mean=len(ious),
            class_distribution=distribution,
            total_pixels=int(total),
            num_images=self.num_images,
        )


def evaluate_model(model, dataloader, device: str = "cpu") -> EvaluationReport:
    """Run the model over a dataloader and accumulate metrics.

    Kept deliberately thin: the arithmetic lives in `ConfusionAccumulator`, which is pure
    numpy and therefore testable without torch, a dataset, or a GPU.
    """
    import torch

    accumulator = ConfusionAccumulator()
    model.eval()

    with torch.no_grad():
        for images, targets in dataloader:
            images = images.to(device)
            logits = model(images)
            predictions = logits.argmax(dim=1).cpu().numpy()
            accumulator.update(predictions, targets.numpy())

    return accumulator.compute()
