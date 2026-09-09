"""Stage 9 — geometric property extraction.

Every measurement here is computed in a local equal-area metric projection, never in
degrees. Computing `polygon.area` on EPSG:4326 coordinates yields square degrees, which
is not a unit of area at all: its relationship to km² varies with latitude, so the number
looks plausible, is wrong by a latitude-dependent factor, and nothing downstream can
detect it. That is the specific silent failure this module exists to prevent.

Missing inputs produce `None`, never `0.0` (CLAUDE.md §70): a spill with no coastline
dataset loaded is "distance not computed", not "on the shoreline".
"""

from __future__ import annotations

from dataclasses import dataclass

from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import transform as shapely_transform

from stage_a.vectorize import WGS84, _local_equal_area_crs


@dataclass
class GeometricProperties:
    """The Stage 9 property set, in the units the frozen contract declares."""

    area_km2: float
    perimeter_km: float
    elongation: float
    centroid_lat: float
    centroid_lon: float
    coastline_distance_km: float | None = None


def _to_metric(geom: Polygon | MultiPolygon) -> Polygon | MultiPolygon:
    """Project a WGS84 geometry into a local equal-area metric CRS centred on itself."""
    metric = _local_equal_area_crs(geom, WGS84)
    project = Transformer.from_crs(WGS84, metric, always_xy=True).transform
    return shapely_transform(project, geom)


def compute_area_km2(geom_wgs84: Polygon | MultiPolygon) -> float:
    return _to_metric(geom_wgs84).area / 1e6


def compute_perimeter_km(geom_wgs84: Polygon | MultiPolygon) -> float:
    metric = _to_metric(geom_wgs84)
    length_m = metric.length if isinstance(metric, Polygon) else sum(p.length for p in metric.geoms)
    return length_m / 1000.0


def compute_elongation(geom_wgs84: Polygon | MultiPolygon) -> float:
    """Aspect ratio (major/minor) of the minimum rotated rectangle.

    Reported as >= 1.0, where 1.0 is a square-ish blob. Elongation is one of the shape
    cues that separates a genuine drifting slick from a compact look-alike, so it is
    measured on the metric projection — an aspect ratio computed in degrees is distorted
    by the cos(latitude) compression of longitude.
    """
    metric = _to_metric(geom_wgs84)
    rect = metric.minimum_rotated_rectangle
    if not hasattr(rect, "exterior"):  # degenerate (point/line) input
        return 1.0

    coords = list(rect.exterior.coords)
    if len(coords) < 4:
        return 1.0

    side_1 = _distance(coords[0], coords[1])
    side_2 = _distance(coords[1], coords[2])
    major, minor = max(side_1, side_2), min(side_1, side_2)
    if minor <= 0:
        return 1.0
    return major / minor


def _distance(p1: tuple[float, float], p2: tuple[float, float]) -> float:
    return ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2) ** 0.5


def compute_coastline_distance_km(
    geom_wgs84: Polygon | MultiPolygon,
    coastline_wgs84=None,
) -> float | None:
    """Distance from the spill to the nearest coastline geometry.

    Returns None when no coastline dataset was supplied — the frozen contract declares
    this field optional precisely so that "not computed" stays distinguishable from
    "zero kilometres away".
    """
    if coastline_wgs84 is None or getattr(coastline_wgs84, "is_empty", True):
        return None

    metric = _local_equal_area_crs(geom_wgs84, WGS84)
    project = Transformer.from_crs(WGS84, metric, always_xy=True).transform

    spill_m = shapely_transform(project, geom_wgs84)
    coastline_m = shapely_transform(project, coastline_wgs84)
    return spill_m.distance(coastline_m) / 1000.0


def extract_properties(
    geom_wgs84: Polygon | MultiPolygon,
    coastline_wgs84=None,
) -> GeometricProperties:
    """Compute the full Stage 9 property set for a spill polygon in EPSG:4326."""
    centroid = geom_wgs84.centroid
    return GeometricProperties(
        area_km2=compute_area_km2(geom_wgs84),
        perimeter_km=compute_perimeter_km(geom_wgs84),
        elongation=compute_elongation(geom_wgs84),
        centroid_lat=float(centroid.y),
        centroid_lon=float(centroid.x),
        coastline_distance_km=compute_coastline_distance_km(geom_wgs84, coastline_wgs84),
    )
