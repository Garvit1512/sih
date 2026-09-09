"""Stage 3 — SAR corpus preprocessing.

Two jobs share one output format here: preparing the labelled public training corpus, and
preparing the per-case demo scenes. They must be preprocessed *identically*. If training
images are normalized one way and the demo scene another, the model still runs and still
emits a mask — just a worse one, with no error raised and no symptom other than the case
that matters most performing mysteriously badly. That is why normalization lives in one
function used by both paths rather than being written twice.

The second silent failure this module guards is georeferencing loss. A tiled scene that
forgets its affine transform produces a spill polygon at coordinates near (0, 0) — off
the west coast of Africa, wherever the actual spill was.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from stage_a.config import DEFAULT_LABEL_PALETTE, NUM_CLASSES


@dataclass
class PaletteReport:
    """What `rgb_to_class_indices` actually found in a label image."""

    mapped_pixels: int
    unmapped_pixels: int
    unmapped_colours: list[tuple[int, int, int]]

    @property
    def is_clean(self) -> bool:
        return self.unmapped_pixels == 0


def rgb_to_class_indices(
    label_rgb: np.ndarray,
    palette: dict[tuple[int, int, int], int] | None = None,
    *,
    tolerance: int = 10,
) -> tuple[np.ndarray, PaletteReport]:
    """Convert an RGB label image to a 2-D array of class indices.

    Unmapped colours are reported rather than folded into the background class. A silent
    fold is the specific corruption this returns a report to prevent: every unrecognized
    pixel would become "sea surface", inflating the majority class, deflating the rare
    ones, and quietly biasing every number Stage 10 later reports — while the dataset
    looked fine.

    `tolerance` accommodates lossy compression in the published archives, which can shift
    a nominal (0, 255, 255) to (2, 253, 255). Matching is nearest-colour within the
    tolerance; anything further away is reported unmapped.
    """
    palette = palette or DEFAULT_LABEL_PALETTE

    if label_rgb.ndim != 3 or label_rgb.shape[2] < 3:
        raise ValueError(f"expected an (H, W, 3) RGB label image, got shape {label_rgb.shape}")

    rgb = label_rgb[:, :, :3].astype(np.int16)
    height, width = rgb.shape[:2]

    indices = np.zeros((height, width), dtype=np.uint8)
    assigned = np.zeros((height, width), dtype=bool)

    for colour, class_index in palette.items():
        distance = np.abs(rgb - np.array(colour, dtype=np.int16)).sum(axis=2)
        match = (distance <= tolerance) & ~assigned
        indices[match] = class_index
        assigned |= match

    unmapped_mask = ~assigned
    unmapped_count = int(unmapped_mask.sum())
    unmapped_colours: list[tuple[int, int, int]] = []
    if unmapped_count:
        sample = rgb[unmapped_mask].reshape(-1, 3)
        counter = Counter(map(tuple, sample.tolist()))
        unmapped_colours = [colour for colour, _ in counter.most_common(10)]

    return indices, PaletteReport(
        mapped_pixels=int(assigned.sum()),
        unmapped_pixels=unmapped_count,
        unmapped_colours=unmapped_colours,
    )


def normalize_image(image: np.ndarray) -> np.ndarray:
    """Scale an image to float32 in [0, 1] using a fixed, corpus-independent rule.

    Deliberately *not* per-image min-max normalization. Per-image scaling makes a scene
    containing only sea surface look identical to one containing a high-contrast slick,
    because both get stretched to fill the range — destroying exactly the signal the model
    needs. A fixed divisor keeps radiometry comparable across scenes.
    """
    array = image.astype(np.float32)
    if array.max() > 1.0:
        array /= 255.0
    return np.clip(array, 0.0, 1.0)


def median_despeckle(image: np.ndarray, kernel_size: int = 3) -> np.ndarray:
    """Suppress SAR speckle with a small median filter.

    Speckle is the grainy multiplicative noise inherent to coherent radar imaging. Left
    in, it produces isolated dark pixels that vectorize into one-pixel "spills"; Stage 7's
    `min_area_px` is the second line of defence, this is the first.

    A median filter is used rather than a Lee/Frost adaptive filter because it preserves
    the slick boundary (which Stage 7 turns into a polygon) while an averaging filter
    blurs it, and boundary fidelity is what the downstream geometry depends on.
    """
    if kernel_size <= 1:
        return image

    try:
        from scipy.ndimage import median_filter
    except ImportError:
        return image  # despeckling is a quality improvement, not a correctness requirement

    if image.ndim == 2:
        return median_filter(image, size=kernel_size)
    channels = [median_filter(image[..., c], size=kernel_size) for c in range(image.shape[2])]
    return np.stack(channels, axis=-1)


def tile_array(
    array: np.ndarray,
    tile_size: int,
    *,
    stride: int | None = None,
) -> list[tuple[np.ndarray, tuple[int, int]]]:
    """Cut an array into tiles, returning each tile with its (row, col) pixel origin.

    The origin travels with every tile so that a tile's model output can be placed back
    into the full scene's pixel grid, and from there into world coordinates via the
    scene's affine transform. Losing it is how georeferencing goes missing.
    """
    stride = stride or tile_size
    height, width = array.shape[:2]
    tiles: list[tuple[np.ndarray, tuple[int, int]]] = []

    for row in range(0, max(height - tile_size + 1, 1), stride):
        for col in range(0, max(width - tile_size + 1, 1), stride):
            tile = array[row : row + tile_size, col : col + tile_size]
            if tile.shape[0] != tile_size or tile.shape[1] != tile_size:
                tile = _pad_to(tile, tile_size)
            tiles.append((tile, (row, col)))

    return tiles


def _pad_to(tile: np.ndarray, size: int) -> np.ndarray:
    pad_rows = size - tile.shape[0]
    pad_cols = size - tile.shape[1]
    padding = [(0, pad_rows), (0, pad_cols)] + [(0, 0)] * (tile.ndim - 2)
    return np.pad(tile, padding, mode="reflect" if min(tile.shape[:2]) > 1 else "constant")


def class_distribution(masks: list[np.ndarray]) -> dict[str, float]:
    """Fraction of pixels per class across a set of masks.

    Stage 10 requires this alongside its metrics: a mean IoU is uninterpretable without
    knowing that oil spill is a small percentage of pixels, because a model can look
    strong on the mean while failing entirely on the class the project is about.
    """
    counts = np.zeros(NUM_CLASSES, dtype=np.int64)
    for mask in masks:
        counts += np.bincount(mask.reshape(-1), minlength=NUM_CLASSES)[:NUM_CLASSES]

    total = counts.sum()
    if total == 0:
        return {}

    from stage_a.config import CLASS_NAMES

    return {name: float(counts[i] / total) for i, name in enumerate(CLASS_NAMES)}


def write_manifest(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
