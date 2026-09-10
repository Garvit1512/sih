"""Stage 7 (first half) — running the trained model over a full SAR scene.

Scenes are larger than the tile size the model was trained at, so inference is tiled and
reassembled. Tiles overlap and are blended, because a hard tile boundary running through
a slick produces a visible seam in the mask, which vectorizes into two adjacent polygons
where there is one spill.

Georeferencing is carried through explicitly rather than reconstructed: the scene's affine
transform and CRS travel with the probability map into `vectorize`, which is what puts the
polygon in the right ocean.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from stage_a.config import NUM_CLASSES
from stage_a.preprocess import median_despeckle, normalize_image


@dataclass
class Scene:
    """A georeferenced SAR scene ready for inference."""

    image: np.ndarray          # (H, W, C), float32 in [0, 1]
    transform: Any             # affine: pixel -> CRS coordinates
    crs: Any
    source_path: Path | None = None


def load_scene(path: Path, *, despeckle: bool = True) -> Scene:
    """Load a scene, preferring a georeferenced raster.

    A GeoTIFF carries its own transform and CRS. A plain JPEG/PNG does not, and this
    function refuses to invent one — a scene without georeferencing cannot produce a
    polygon at real coordinates, and silently defaulting to an identity transform would
    place the spill at longitude 0, latitude 0 with no error raised.
    """
    import rasterio

    path = Path(path)

    with rasterio.open(path) as handle:
        array = handle.read()  # (bands, H, W)
        transform = handle.transform
        crs = handle.crs

        if crs is None:
            raise ValueError(
                f"{path.name} carries no CRS. Stage 7 cannot georeference its output without "
                "one — supply a GeoTIFF, or attach a .aux.xml / world file to this scene."
            )

    image = np.transpose(array, (1, 2, 0))
    if image.shape[2] == 1:
        image = np.repeat(image, 3, axis=2)
    elif image.shape[2] > 3:
        image = image[:, :, :3]

    if despeckle:
        image = median_despeckle(image)

    return Scene(image=normalize_image(image), transform=transform, crs=crs, source_path=path)


def predict_scene(
    model,
    scene: Scene,
    *,
    tile_size: int = 256,
    overlap: int = 32,
    device: str = "cpu",
    batch_size: int = 4,
) -> tuple[np.ndarray, np.ndarray]:
    """Run tiled inference and return (probabilities (C, H, W), class_mask (H, W)).

    Overlapping tiles are accumulated into a summed probability map and divided by a
    per-pixel contribution count, which averages the overlap region rather than letting
    whichever tile was written last win.
    """
    import torch

    height, width = scene.image.shape[:2]
    stride = max(tile_size - overlap, 1)

    probability_sum = np.zeros((NUM_CLASSES, height, width), dtype=np.float32)
    contribution = np.zeros((height, width), dtype=np.float32)

    origins = _tile_origins(height, width, tile_size, stride)
    model.eval()

    with torch.no_grad():
        for start in range(0, len(origins), batch_size):
            batch_origins = origins[start : start + batch_size]
            tiles = [_extract_tile(scene.image, r, c, tile_size) for r, c in batch_origins]
            batch = np.stack(tiles)
            tensor = torch.from_numpy(batch.transpose(0, 3, 1, 2)).float().to(device)

            probabilities = torch.softmax(model(tensor), dim=1).cpu().numpy()

            for (row, col), tile_probs in zip(batch_origins, probabilities, strict=True):
                rows = slice(row, min(row + tile_size, height))
                cols = slice(col, min(col + tile_size, width))
                valid_h = rows.stop - rows.start
                valid_w = cols.stop - cols.start

                probability_sum[:, rows, cols] += tile_probs[:, :valid_h, :valid_w]
                contribution[rows, cols] += 1.0

    # Every pixel is covered by construction, but guard against division by zero rather
    # than emitting silent NaNs that would propagate into the confidence score.
    contribution = np.maximum(contribution, 1e-6)
    probabilities = probability_sum / contribution[None, :, :]

    return probabilities, probabilities.argmax(axis=0).astype(np.uint8)


def _tile_origins(height: int, width: int, tile_size: int, stride: int) -> list[tuple[int, int]]:
    """Tile origins covering the whole scene, with the last row/column flush to the edge."""
    rows = list(range(0, max(height - tile_size, 0) + 1, stride))
    cols = list(range(0, max(width - tile_size, 0) + 1, stride))

    if rows[-1] + tile_size < height:
        rows.append(max(height - tile_size, 0))
    if cols[-1] + tile_size < width:
        cols.append(max(width - tile_size, 0))

    return [(r, c) for r in rows for c in cols]


def _extract_tile(image: np.ndarray, row: int, col: int, tile_size: int) -> np.ndarray:
    tile = image[row : row + tile_size, col : col + tile_size]
    if tile.shape[0] == tile_size and tile.shape[1] == tile_size:
        return tile

    padded = np.zeros((tile_size, tile_size, image.shape[2]), dtype=image.dtype)
    padded[: tile.shape[0], : tile.shape[1]] = tile
    return padded
