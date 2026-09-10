"""Stage 8 — look-alike confidence extraction and propagation.

What this score is: an indicative, uncalibrated expression of how strongly the model
separated *oil spill* from *look-alike* over the detected region.

What it is NOT: a calibrated probability. A softmax output is a normalized activation,
not a frequency — a mean value of 0.87 does not mean 87 of 100 such detections are real
spills, because nothing in training constrained it to that meaning. The contract's
`type` field is the literal `"indicative_uncalibrated"` for exactly this reason, and
CLAUDE.md §23 forbids presenting it as "87% probability of oil". Anything rendering this
value must carry the wording along with it.

The headline value is a discrimination ratio rather than the raw mean oil probability,
because the raw mean answers "how confident was the model overall" while the ratio
answers the question the stage actually exists to ask: oil, or look-alike?
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from stage_a.config import LOOK_ALIKE_CLASS, OIL_SPILL_CLASS

CONFIDENCE_LABEL = "Indicative detection confidence"
CONFIDENCE_TYPE = "indicative_uncalibrated"


@dataclass
class LookAlikeConfidence:
    """The Stage 8 output, with its components kept separately inspectable.

    The components are retained rather than collapsed into the single number because
    Stage 41's evidence breakdown and Stage 45's UI both need to show *why* a detection
    scored as it did, and a bare scalar cannot be explained after the fact.
    """

    value: float
    mean_oil_probability: float
    mean_look_alike_probability: float
    detected_pixel_count: int

    def to_contract(self) -> dict:
        """The exact `DetectionConfidence` shape from the frozen contract."""
        return {
            "value": float(self.value),
            "type": CONFIDENCE_TYPE,
            "label": CONFIDENCE_LABEL,
        }

    def evidence_lines(self) -> list[str]:
        """Human-readable evidence, phrased to stay inside the uncalibrated framing."""
        return [
            f"Mean oil-spill class activation over the detected region: "
            f"{self.mean_oil_probability:.2f} (indicative, uncalibrated).",
            f"Mean look-alike class activation over the same region: "
            f"{self.mean_look_alike_probability:.2f}.",
            f"Detected region size: {self.detected_pixel_count} pixels.",
        ]


def extract_confidence(
    probabilities: np.ndarray,
    class_mask: np.ndarray,
    *,
    target_class: int = OIL_SPILL_CLASS,
    look_alike_class: int = LOOK_ALIKE_CLASS,
) -> LookAlikeConfidence | None:
    """Derive the indicative confidence over the pixels classified as `target_class`.

    Args:
        probabilities: softmax output of shape (num_classes, H, W).
        class_mask: argmax class indices of shape (H, W).

    Returns None when nothing was detected — an absent detection has no confidence, and
    returning 0.0 would be read downstream as "detected, with no confidence", which is a
    different and false statement (CLAUDE.md §70).
    """
    if probabilities.ndim != 3:
        raise ValueError(f"probabilities must be (C, H, W), got shape {probabilities.shape}")
    if probabilities.shape[1:] != class_mask.shape:
        raise ValueError(
            f"probabilities spatial dims {probabilities.shape[1:]} do not match "
            f"class_mask {class_mask.shape}"
        )

    region = class_mask == target_class
    detected = int(region.sum())
    if detected == 0:
        return None

    mean_oil = float(probabilities[target_class][region].mean())
    mean_look_alike = float(probabilities[look_alike_class][region].mean())

    # Discrimination ratio, bounded to [0, 1] as the contract requires. The denominator
    # can only be zero if both activations are exactly zero over every detected pixel,
    # which argmax makes impossible for the winning class — guarded anyway.
    denominator = mean_oil + mean_look_alike
    value = mean_oil / denominator if denominator > 0 else 0.0

    return LookAlikeConfidence(
        value=float(np.clip(value, 0.0, 1.0)),
        mean_oil_probability=mean_oil,
        mean_look_alike_probability=mean_look_alike,
        detected_pixel_count=detected,
    )
