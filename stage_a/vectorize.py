"""Stage 7 — mask-to-polygon vectorization.

Turns the segmentation model's pixel-space output into a georeferenced spill polygon in
WGS84 / EPSG:4326, which is the first point where the frozen coordinate contract from
Stage 1 binds to real model output.

Axis-order discipline (the single most consequential bug available to this module):
every pyproj transformer here is built with `always_xy=True`, so transformer input and
output are ordered (x, y) = (lon, lat) regardless of what axis order the CRS's authority
definition declares. GeoJSON coordinates are therefore emitted as [lon, lat] per RFC
7946, while the API's `Coordinate` object is {lat, lon} — `centroid_coordinate()` is the
only place the two representations meet, mirroring `Coordinate.to_geojson_point()` on the
backend side. See tests/test_vectorize.py for the regression test.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from pyproj import CRS, Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform as shapely_transform
from shapely.ops import unary_union

WGS84 = CRS.from_epsg(4326)


def mask_to_polygons(
    class_mask: np.ndarray,
    *,
    target_class: int,
    transform: Any,
    crs: Any,
    min_area_px: int = 25,
    simplify_tolerance_m: float | None = None,
) -> list[Polygon]:
    """Polygonize the pixels of `target_class` into georeferenced polygons.

    Args:
        class_mask: 2-D integer array of class indices.
        target_class: which class index to vectorize (oil spill, normally).
        transform: affine geotransform mapping pixel -> CRS coordinates.
        crs: CRS of `transform`.
        min_area_px: drop specks smaller than this many pixels. Speckle noise in SAR
            produces isolated dark pixels; without a floor they become "spills".
        simplify_tolerance_m: optional Douglas-Peucker tolerance, applied in a metric CRS
            so the tolerance means metres rather than degrees.

    Returns polygons in the *source* CRS. Reproject with `to_wgs84()`.
    """
    from rasterio import features

    if class_mask.ndim != 2:
        raise ValueError(f"class_mask must be 2-D, got shape {class_mask.shape}")

    binary = (class_mask == target_class).astype(np.uint8)
    if not binary.any():
        return []

    polygons: list[Polygon] = []
    pixel_area = abs(transform.a * transform.e)
    min_area_crs = min_area_px * pixel_area

    for geom_dict, value in features.shapes(binary, mask=binary.astype(bool), transform=transform):
        if value != 1:
            continue
        geom = shape(geom_dict)
        if geom.is_empty or geom.area < min_area_crs:
            continue
        polygons.append(geom.buffer(0))  # buffer(0) repairs self-intersections

    if simplify_tolerance_m and polygons:
        polygons = [_simplify_metric(p, crs, simplify_tolerance_m) for p in polygons]

    return sorted(polygons, key=lambda p: p.area, reverse=True)


def _simplify_metric(geom: Polygon, crs: Any, tolerance_m: float) -> Polygon:
    """Simplify with a tolerance expressed in metres, whatever the source CRS is."""
    src = CRS.from_user_input(crs)
    if src.is_projected:
        return geom.simplify(tolerance_m, preserve_topology=True)

    metric = _local_equal_area_crs(geom, src)
    fwd = Transformer.from_crs(src, metric, always_xy=True).transform
    inv = Transformer.from_crs(metric, src, always_xy=True).transform

    projected = shapely_transform(fwd, geom)
    simplified = projected.simplify(tolerance_m, preserve_topology=True)
    return shapely_transform(inv, simplified)


def _local_equal_area_crs(geom: Polygon | MultiPolygon, src: CRS) -> CRS:
    """A Lambert azimuthal equal-area CRS centred on the geometry.

    Chosen over a fixed UTM zone because a spill can straddle a zone boundary, and over a
    global equal-area projection because distortion at the feature's own location is what
    matters for area and perimeter.
    """
    centroid = geom.centroid
    if src != WGS84:
        to_wgs = Transformer.from_crs(src, WGS84, always_xy=True).transform
        centroid = shapely_transform(to_wgs, centroid)
    return CRS.from_proj4(
        f"+proj=laea +lat_0={centroid.y} +lon_0={centroid.x} +x_0=0 +y_0=0 "
        "+datum=WGS84 +units=m +no_defs"
    )


def to_wgs84(geom: Polygon | MultiPolygon, src_crs: Any) -> Polygon | MultiPolygon:
    """Reproject a geometry to EPSG:4326 with explicit (lon, lat) axis order."""
    src = CRS.from_user_input(src_crs)
    if src == WGS84:
        return geom
    project = Transformer.from_crs(src, WGS84, always_xy=True).transform
    return shapely_transform(project, geom)


def merge_polygons(polygons: list[Polygon]) -> Polygon | MultiPolygon | None:
    """Union polygons into the single geometry the contract carries.

    A spill frequently vectorizes into several disjoint patches. Returning only the
    largest would silently discard oil; the contract's `GeoJSONPolygon` holds one polygon
    with rings, so callers that must emit a single Polygon use `largest_polygon()` and
    record the discarded count rather than dropping it silently.
    """
    if not polygons:
        return None
    return unary_union(polygons)


def largest_polygon(polygons: list[Polygon]) -> Polygon | None:
    return max(polygons, key=lambda p: p.area) if polygons else None


def polygon_to_geojson(geom: Polygon) -> dict:
    """Emit a GeoJSON Polygon dict with [lon, lat] coordinates and plain lists.

    `shapely.mapping` produces tuples; the frozen `GeoJSONPolygon` schema declares
    `list[list[list[float]]]`, and pydantic will coerce, but round-tripping through JSON
    is cleaner if we hand it lists to begin with.
    """
    if not isinstance(geom, Polygon):
        raise TypeError(f"expected a Polygon for the frozen contract, got {type(geom).__name__}")
    geo = mapping(geom)
    return {
        "type": "Polygon",
        "coordinates": [[[float(x), float(y)] for x, y in ring] for ring in geo["coordinates"]],
    }


def centroid_coordinate(geom: Polygon | MultiPolygon) -> dict[str, float]:
    """Centroid as the API's {lat, lon} object — NOT GeoJSON order.

    This is the mirror of `Coordinate.to_geojson_point()` in the backend: the two
    representations meet here and nowhere else in Stage A.
    """
    c = geom.centroid
    return {"lat": float(c.y), "lon": float(c.x)}
