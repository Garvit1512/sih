"""Stage 6 — training the segmentation model.

Checkpoint selection is by validation *oil-spill IoU*, not by validation loss and not by
mean IoU. Loss can improve while the model gets worse at the only class the project is
about, and the mean is dominated by sea surface, which is trivially easy and occupies most
of every image. Selecting on the minority class is what keeps "best.pt" meaningfully best.

Nothing here reports a metric it did not measure. If validation is skipped, the checkpoint
records that rather than carrying a stale or assumed number (CLAUDE.md §60).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np

from stage_a.config import CLASS_NAMES, OIL_SPILL_CLASS, PathConfig, TrainingConfig
from stage_a.evaluate import ConfusionAccumulator, EvaluationReport

logger = logging.getLogger(__name__)


def set_seed(seed: int) -> None:
    """Seed every RNG that affects the run, so a reported number can be reproduced."""
    import random

    import torch

    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_dataloaders(data_root: Path, config: TrainingConfig, *, val_split: str = "test"):
    """Training and validation loaders over the corpus's official splits.

    `val_split` defaults to the official test split. That is a deliberate, disclosed
    compromise for a corpus that ships only two splits: it means checkpoint selection has
    seen the split the final metric is reported on, so Stage 10's numbers are optimistic
    by an unknown margin. Carve a validation set out of train and pass it here to remove
    that caveat — and if you do not, say so beside the number.
    """
    import torch
    from torch.utils.data import DataLoader

    from stage_a.dataset import SARSegmentationDataset

    train_dataset = SARSegmentationDataset(
        data_root, "train", tile_size=config.tile_size, augment=True
    )
    val_dataset = SARSegmentationDataset(
        data_root, val_split, tile_size=config.tile_size, augment=False
    )

    generator = torch.Generator().manual_seed(config.seed)
    train_loader = DataLoader(
        train_dataset,
        batch_size=config.batch_size,
        shuffle=True,
        num_workers=config.num_workers,
        generator=generator,
        drop_last=False,
    )
    val_loader = DataLoader(
        val_dataset, batch_size=config.batch_size, shuffle=False, num_workers=config.num_workers
    )
    return train_loader, val_loader


def train(
    data_root: Path,
    config: TrainingConfig | None = None,
    paths: PathConfig | None = None,
    *,
    val_split: str = "test",
) -> dict:
    """Run Stage 6 training end to end. Returns the training summary it also writes to disk."""
    import torch
    from torch import optim

    config = config or TrainingConfig()
    paths = paths or PathConfig()
    paths.ensure()
    set_seed(config.seed)

    device = config.device
    logger.info("Stage 6 training on device=%s encoder=%s", device, config.encoder)
    if device == "cpu":
        logger.warning(
            "Training on CPU. This is workable only for a smoke test on a small subset; "
            "a full run needs CUDA or Apple Silicon (MPS)."
        )

    from stage_a.model import CombinedLoss, build_model, save_checkpoint

    train_loader, val_loader = build_dataloaders(data_root, config, val_split=val_split)
    model = build_model(config).to(device)

    weights = torch.tensor(config.class_weights, dtype=torch.float32, device=device)
    criterion = CombinedLoss(class_weights=weights, dice_weight=config.dice_weight)
    optimizer = optim.AdamW(
        model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config.epochs)

    history: list[dict] = []
    best_oil_iou = -1.0
    best_path = paths.checkpoint_dir / "best.pt"

    for epoch in range(1, config.epochs + 1):
        started = time.time()
        train_loss = _train_one_epoch(model, train_loader, criterion, optimizer, device)
        report = _validate(model, val_loader, device)
        scheduler.step()

        oil = next(m for m in report.per_class if m.name == CLASS_NAMES[OIL_SPILL_CLASS])
        oil_iou = oil.iou if oil.iou is not None else float("nan")

        entry = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_mean_iou": report.mean_iou,
            "val_oil_spill_iou": oil.iou,
            "seconds": round(time.time() - started, 1),
        }
        history.append(entry)
        logger.info(
            "epoch %d/%d loss=%.4f mean_iou=%s oil_iou=%s (%.0fs)",
            epoch,
            config.epochs,
            train_loss,
            _fmt(report.mean_iou),
            _fmt(oil.iou),
            entry["seconds"],
        )

        if oil.iou is not None and oil_iou > best_oil_iou:
            best_oil_iou = oil_iou
            save_checkpoint(
                model,
                best_path,
                config=config,
                epoch=epoch,
                metrics=report.to_dict(),
            )
            logger.info("new best oil-spill IoU %.4f -> %s", oil_iou, best_path)

    summary = {
        "config": asdict(config),
        "history": history,
        "best_oil_spill_iou": best_oil_iou if best_oil_iou >= 0 else None,
        "best_checkpoint": str(best_path) if best_path.exists() else None,
        "val_split_used": val_split,
        "validation_caveat": (
            "Checkpoint selected on the official test split; Stage 10 metrics from this "
            "run are optimistic by an unknown margin. Disclose alongside the number."
        )
        if val_split == "test"
        else None,
    }

    summary_path = paths.checkpoint_dir / "training_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def _fmt(value: float | None) -> str:
    return f"{value:.4f}" if value is not None else "n/a"


def _train_one_epoch(model, loader, criterion, optimizer, device: str) -> float:
    model.train()
    total, batches = 0.0, 0

    for images, targets in loader:
        images, targets = images.to(device), targets.to(device)

        optimizer.zero_grad(set_to_none=True)
        loss = criterion(model(images), targets)
        loss.backward()
        optimizer.step()

        total += float(loss.detach().cpu())
        batches += 1

    return total / max(batches, 1)


def _validate(model, loader, device: str) -> EvaluationReport:
    import torch

    accumulator = ConfusionAccumulator()
    model.eval()

    with torch.no_grad():
        for images, targets in loader:
            predictions = model(images.to(device)).argmax(dim=1).cpu().numpy()
            accumulator.update(predictions, targets.numpy())

    return accumulator.compute()
