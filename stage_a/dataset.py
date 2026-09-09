"""Stage 3 — dataset access with the official train/test split preserved.

The published split is preserved rather than re-drawn. This matters more than it looks:
Stage 10's metrics are only comparable to published results on the same corpus if they
are measured on the same held-out images, and re-shuffling silently leaks near-duplicate
scenes across the boundary, which inflates every number without any visible symptom.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from stage_a.preprocess import median_despeckle, normalize_image, rgb_to_class_indices

logger = logging.getLogger(__name__)

# Layouts seen across the public mirrors of the 5-class SAR oil-spill corpus. Tried in
# order; the first that resolves for a split wins.
_IMAGE_DIR_CANDIDATES = ("images", "image", "JPEGImages")
_LABEL_DIR_CANDIDATES = ("labels_1D", "labels", "masks", "SegmentationClass", "annotations")

_IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".tif", ".tiff")


@dataclass
class SplitPaths:
    images_dir: Path
    labels_dir: Path
    pairs: list[tuple[Path, Path]]


def resolve_split(root: Path, split: str) -> SplitPaths:
    """Locate the image/label directories for a split and pair the files by stem.

    Raises rather than guessing when a split is missing or nothing pairs up — an empty
    dataset that trains happily for forty epochs on zero batches is a worse outcome than
    a loud failure at startup.
    """
    split_root = root / split
    if not split_root.is_dir():
        raise FileNotFoundError(
            f"No '{split}' split under {root}. Expected the corpus's official layout, "
            f"e.g. {root / split / 'images'}."
        )

    images_dir = _first_existing(split_root, _IMAGE_DIR_CANDIDATES)
    labels_dir = _first_existing(split_root, _LABEL_DIR_CANDIDATES)

    def _index(directory: Path) -> dict[str, Path]:
        return {
            p.stem: p for p in sorted(directory.iterdir()) if p.suffix.lower() in _IMAGE_SUFFIXES
        }

    images = _index(images_dir)
    labels = _index(labels_dir)

    common = sorted(set(images) & set(labels))
    if not common:
        raise RuntimeError(
            f"Found {len(images)} images and {len(labels)} labels under {split_root} but no "
            "matching stems. The archive layout differs from what this loader expects."
        )

    missing_labels = sorted(set(images) - set(labels))
    if missing_labels:
        logger.warning(
            "%d image(s) in '%s' have no matching label and are excluded (e.g. %s).",
            len(missing_labels),
            split,
            ", ".join(missing_labels[:5]),
        )

    return SplitPaths(
        images_dir=images_dir,
        labels_dir=labels_dir,
        pairs=[(images[stem], labels[stem]) for stem in common],
    )


def _first_existing(parent: Path, candidates: tuple[str, ...]) -> Path:
    for name in candidates:
        path = parent / name
        if path.is_dir():
            return path
    raise FileNotFoundError(
        f"None of {candidates} exist under {parent}. Contents: "
        f"{[p.name for p in parent.iterdir()][:10]}"
    )


def load_image(path: Path) -> np.ndarray:
    from PIL import Image

    with Image.open(path) as handle:
        return np.array(handle.convert("RGB"))


def load_label(path: Path) -> np.ndarray:
    """Load a label image as class indices, accepting either RGB or single-channel form."""
    from PIL import Image

    with Image.open(path) as handle:
        array = np.array(handle)

    if array.ndim == 2:
        return array.astype(np.uint8)

    indices, report = rgb_to_class_indices(array)
    if not report.is_clean:
        logger.warning(
            "%s: %d pixel(s) matched no palette entry (top unmapped colours: %s). "
            "These default to sea_surface — verify the palette before trusting metrics.",
            path.name,
            report.unmapped_pixels,
            report.unmapped_colours[:3],
        )
    return indices


class SARSegmentationDataset:
    """Torch-compatible dataset over one official split.

    Kept as a plain class implementing `__len__`/`__getitem__` rather than subclassing
    `torch.utils.data.Dataset` so that this module imports on a machine without torch —
    which is what lets the preprocessing and pairing logic be tested without a GPU box.
    """

    def __init__(
        self,
        root: Path,
        split: str,
        *,
        tile_size: int = 256,
        augment: bool = False,
        despeckle: bool = True,
    ) -> None:
        self.split_paths = resolve_split(Path(root), split)
        self.tile_size = tile_size
        self.augment = augment
        self.despeckle = despeckle

    def __len__(self) -> int:
        return len(self.split_paths.pairs)

    def __getitem__(self, index: int):
        image_path, label_path = self.split_paths.pairs[index]

        image = load_image(image_path)
        mask = load_label(label_path)

        if self.despeckle:
            image = median_despeckle(image)
        image = normalize_image(image)

        image, mask = _resize_pair(image, mask, self.tile_size)

        if self.augment:
            image, mask = _augment(image, mask)

        import torch

        image_tensor = torch.from_numpy(np.ascontiguousarray(image.transpose(2, 0, 1))).float()
        mask_tensor = torch.from_numpy(np.ascontiguousarray(mask)).long()
        return image_tensor, mask_tensor


def _resize_pair(image: np.ndarray, mask: np.ndarray, size: int) -> tuple[np.ndarray, np.ndarray]:
    """Resize image and mask together.

    The mask uses nearest-neighbour resampling — bilinear would interpolate *between class
    indices*, inventing class 1.5 where oil spill meets look-alike, which is meaningless
    and silently corrupts the targets.
    """
    from PIL import Image

    if image.shape[0] == size and image.shape[1] == size:
        return image, mask

    image_resized = np.array(
        Image.fromarray((image * 255).astype(np.uint8)).resize((size, size), Image.BILINEAR)
    ).astype(np.float32) / 255.0
    mask_resized = np.array(Image.fromarray(mask).resize((size, size), Image.NEAREST))
    return image_resized, mask_resized


def _augment(image: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Flips and 90-degree rotations only.

    Deliberately geometry-only. Colour jitter and brightness shifts are standard for
    optical imagery but wrong for SAR: backscatter intensity *is* the physical signal that
    distinguishes oil from open water, so perturbing it teaches the model to ignore the
    one cue that matters.
    """
    if np.random.rand() < 0.5:
        image, mask = np.fliplr(image), np.fliplr(mask)
    if np.random.rand() < 0.5:
        image, mask = np.flipud(image), np.flipud(mask)

    turns = np.random.randint(0, 4)
    if turns:
        image, mask = np.rot90(image, turns), np.rot90(mask, turns)

    return np.ascontiguousarray(image), np.ascontiguousarray(mask)
