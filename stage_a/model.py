"""Stage 6 — the multi-class SAR segmentation model.

A U-Net with a pretrained encoder rather than a from-scratch architecture. This is the
Risk Register's named lever for keeping training to wall-clock hours: the public SAR
oil-spill corpus is small enough that a randomly-initialized encoder spends most of its
epochs relearning generic edge and texture filters that ImageNet weights already encode.

Loss is cross-entropy plus Dice. Cross-entropy alone optimizes per-pixel accuracy, and
because oil-spill pixels are a small minority of the corpus, a model that predicts "sea
surface" everywhere scores well on it while being useless. Dice is computed per class and
averaged, so a class that occupies 1% of the pixels still contributes a full share of the
loss — that term is what forces the model to actually find the spill.
"""

from __future__ import annotations

from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F

from stage_a.config import NUM_CLASSES, TrainingConfig


def build_model(config: TrainingConfig) -> nn.Module:
    """Construct the segmentation network described by `config`."""
    try:
        import segmentation_models_pytorch as smp
    except ImportError as exc:  # pragma: no cover - environment guard
        raise ImportError(
            "segmentation-models-pytorch is required for Stage A training. "
            "Install the Stage A extras: pip install -r stage_a/requirements.txt"
        ) from exc

    return smp.Unet(
        encoder_name=config.encoder,
        encoder_weights=config.encoder_weights,
        in_channels=config.in_channels,
        classes=NUM_CLASSES,
    )


class DiceLoss(nn.Module):
    """Multi-class soft Dice, averaged over classes present in the batch.

    Classes absent from a batch are excluded rather than scored as perfect. Including
    them would hand the model free loss reduction for correctly predicting nothing, which
    flatters the metric on exactly the rare classes this loss exists to protect.
    """

    def __init__(self, smooth: float = 1.0) -> None:
        super().__init__()
        self.smooth = smooth

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = F.softmax(logits, dim=1)
        one_hot = F.one_hot(targets, num_classes=probs.shape[1]).permute(0, 3, 1, 2).float()

        dims = (0, 2, 3)
        intersection = (probs * one_hot).sum(dims)
        cardinality = probs.sum(dims) + one_hot.sum(dims)
        dice = (2.0 * intersection + self.smooth) / (cardinality + self.smooth)

        present = one_hot.sum(dims) > 0
        if not present.any():
            return 1.0 - dice.mean()
        return 1.0 - dice[present].mean()


class CombinedLoss(nn.Module):
    """Weighted cross-entropy + Dice."""

    def __init__(self, class_weights: torch.Tensor | None, dice_weight: float = 0.5) -> None:
        super().__init__()
        self.ce = nn.CrossEntropyLoss(weight=class_weights)
        self.dice = DiceLoss()
        self.dice_weight = dice_weight

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return (1 - self.dice_weight) * self.ce(logits, targets) + self.dice_weight * self.dice(
            logits, targets
        )


def save_checkpoint(
    model: nn.Module,
    path: Path,
    *,
    config: TrainingConfig,
    epoch: int,
    metrics: dict,
) -> None:
    """Persist weights together with the config that produced them.

    The config travels with the checkpoint so that inference cannot silently load weights
    trained at a different tile size or channel count — a mismatch that produces a model
    which runs and returns confident nonsense.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "encoder": config.encoder,
            "in_channels": config.in_channels,
            "tile_size": config.tile_size,
            "num_classes": NUM_CLASSES,
            "epoch": epoch,
            "metrics": metrics,
        },
        path,
    )


def load_checkpoint(path: Path, *, device: str = "cpu") -> tuple[nn.Module, dict]:
    """Rebuild the model described by a checkpoint and load its weights."""
    payload = torch.load(path, map_location=device, weights_only=False)

    config = TrainingConfig(
        encoder=payload["encoder"],
        encoder_weights=None,  # weights come from the checkpoint, not from ImageNet
        in_channels=payload["in_channels"],
        tile_size=payload["tile_size"],
    )
    model = build_model(config)
    model.load_state_dict(payload["state_dict"])
    model.to(device)
    model.eval()
    return model, payload
