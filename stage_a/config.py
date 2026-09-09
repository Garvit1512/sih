"""Stage A configuration — classes, label palette, device selection, hyperparameters.

Nothing here is hardcoded into business logic elsewhere (CLAUDE.md §43): every value is
overridable via environment variables prefixed `STAGE_A_`, or via the CLI.

The five-class scheme is fixed by the public SAR oil-spill dataset and by the detection
contract in docs/contracts.md — it is not a tunable.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

STAGE_A_ROOT = Path(__file__).resolve().parent
REPO_ROOT = STAGE_A_ROOT.parent

# ---------------------------------------------------------------------------
# Classes
# ---------------------------------------------------------------------------

# Index order is the model's output channel order and must never be reordered without
# retraining — checkpoints encode it positionally.
CLASS_NAMES: tuple[str, ...] = (
    "sea_surface",
    "oil_spill",
    "look_alike",
    "ship",
    "land",
)

OIL_SPILL_CLASS = CLASS_NAMES.index("oil_spill")
LOOK_ALIKE_CLASS = CLASS_NAMES.index("look_alike")
NUM_CLASSES = len(CLASS_NAMES)

# RGB label colours used by the public Krestenitis et al. oil-spill dataset.
#
# These are DEFAULTS, not an assertion about the archive you downloaded. `preprocess.py`
# verifies every colour it encounters against this table and reports unmapped colours
# instead of silently folding them into sea_surface — a silent fold would inflate the
# background class and quietly corrupt every metric in Stage 10 (CLAUDE.md §70).
DEFAULT_LABEL_PALETTE: dict[tuple[int, int, int], int] = {
    (0, 0, 0): 0,        # sea surface
    (0, 255, 255): 1,    # oil spill     (cyan)
    (255, 0, 0): 2,      # look-alike    (red)
    (153, 76, 0): 3,     # ship          (brown)
    (0, 153, 0): 4,      # land          (green)
}


# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------

def resolve_device(preference: str | None = None) -> str:
    """Pick the best available torch device.

    Order: explicit preference > CUDA > Apple Silicon (MPS) > CPU. Import of torch is
    deferred so that the geospatial half of Stage A (vectorize/geometry/confidence) stays
    importable on a machine with no torch installed.
    """
    preference = preference or os.getenv("STAGE_A_DEVICE")
    if preference:
        return preference

    try:
        import torch
    except ImportError:
        return "cpu"

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    return int(raw) if raw else default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    return float(raw) if raw else default


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    return Path(raw) if raw else default


@dataclass
class TrainingConfig:
    """Stage 6 hyperparameters.

    Defaults target an Apple Silicon / single mid-range GPU budget: a pretrained encoder
    plus modest tiles, which is the Risk Register's named lever for keeping segmentation
    training to wall-clock hours rather than days.
    """

    encoder: str = os.getenv("STAGE_A_ENCODER", "resnet34")
    encoder_weights: str | None = os.getenv("STAGE_A_ENCODER_WEIGHTS", "imagenet")
    in_channels: int = _env_int("STAGE_A_IN_CHANNELS", 3)
    tile_size: int = _env_int("STAGE_A_TILE_SIZE", 256)
    batch_size: int = _env_int("STAGE_A_BATCH_SIZE", 8)
    epochs: int = _env_int("STAGE_A_EPOCHS", 40)
    learning_rate: float = _env_float("STAGE_A_LR", 3e-4)
    weight_decay: float = _env_float("STAGE_A_WEIGHT_DECAY", 1e-4)
    dice_weight: float = _env_float("STAGE_A_DICE_WEIGHT", 0.5)
    num_workers: int = _env_int("STAGE_A_NUM_WORKERS", 0)
    seed: int = _env_int("STAGE_A_SEED", 1337)
    device: str = field(default_factory=resolve_device)

    # Oil spill is a small-minority class; unweighted cross-entropy collapses to
    # predicting sea surface everywhere and still reports a flattering pixel accuracy.
    # These weights are a starting point to be tuned against validation IoU, not a
    # validated setting.
    class_weights: tuple[float, ...] = (0.5, 3.0, 2.0, 2.0, 1.0)


@dataclass
class PathConfig:
    """Filesystem layout. Raw archives and checkpoints stay out of git (see .gitignore)."""

    raw_dir: Path = field(
        default_factory=lambda: _env_path("STAGE_A_RAW_DIR", STAGE_A_ROOT / "data" / "raw")
    )
    processed_dir: Path = field(
        default_factory=lambda: _env_path(
            "STAGE_A_PROCESSED_DIR", STAGE_A_ROOT / "data" / "processed"
        )
    )
    checkpoint_dir: Path = field(
        default_factory=lambda: _env_path("STAGE_A_CHECKPOINT_DIR", STAGE_A_ROOT / "checkpoints")
    )
    artifact_dir: Path = field(
        default_factory=lambda: _env_path("STAGE_A_ARTIFACT_DIR", STAGE_A_ROOT / "artifacts")
    )

    def ensure(self) -> None:
        for path in (self.raw_dir, self.processed_dir, self.checkpoint_dir, self.artifact_dir):
            path.mkdir(parents=True, exist_ok=True)
