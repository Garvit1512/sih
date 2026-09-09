"""Stage 7 regression tests — polygonization and, above all, axis order.

The lat/lon swap is the failure this suite exists to catch: a swapped polygon is valid
GeoJSON, renders on a map, passes schema validation, and is simply in the wrong ocean.
"""

from __future__ import annotations

import numpy as np
import pytest
from rasterio.transform import from_origin
from shapely.geometry import Polygon

from stage_a.config import OIL_SPILL_CLASS
from stage_a.vectorize import (
    centroid_coordinate,
    largest_polygon,
    mask_to_polygons,
    polygon_to_geojson,
    to_wgs84,
)

# A patch of ocean in the Arabian Sea: lon ~67, lat ~15. Chosen because lat and lon are
# far apart numerically and lat is well inside [-90, 90] while lon is outside it — so a
# swap is unambiguous rather than merely wrong by a little.
WEST, NORTH = 67.0, 15.5
PIXEL_DEG = 0.001


def _mask_with_block(rows=64, cols=64, block=slice(10, 30)):
    mask = np.zeros((rows, cols), dtype=np.uint8)
    mask[block, block] = OIL_SPILL_CLASS
    return mask


def _transform():
    return from_origin(WEST, NORTH, PIXEL_DEG, PIXEL_DEG)


def test_polygonizes_the_target_class_only():
    mask = _mask_with_block()
    mask[40:45, 40:45] = 4  # a patch of land, which must not be vectorized as spill

    polygons = mask_to_polygons(
        mask, target_class=OIL_SPILL_CLASS, transform=_transform(), crs="EPSG:4326"
    )

    assert len(polygons) == 1


def test_coordinates_are_lon_lat_not_lat_lon():
    """The axis-order regression test."""
    polygons = mask_to_polygons(
        _mask_with_block(), target_class=OIL_SPILL_CLASS, transform=_transform(), crs="EPSG:4326"
    )
    geojson = polygon_to_geojson(largest_polygon(polygons))

    xs = [x for ring in geojson["coordinates"] for x, _ in ring]
    ys = [y for ring in geojson["coordinates"] for _, y in ring]

    # GeoJSON position order is [longitude, latitude] per RFC 7946.
    assert all(66.9 < x < 67.1 for x in xs), f"ordinate 1 should be longitude ~67, got {xs[:3]}"
    assert all(15.4 < y < 15.6 for y in ys), f"ordinate 2 should be latitude ~15.5, got {ys[:3]}"


def test_centroid_coordinate_maps_to_lat_lon_object():
    """`Coordinate` is {lat, lon} — the inverse ordering of the GeoJSON it sits beside."""
    polygons = mask_to_polygons(
        _mask_with_block(), target_class=OIL_SPILL_CLASS, transform=_transform(), crs="EPSG:4326"
    )
    coord = centroid_coordinate(largest_polygon(polygons))

    assert 15.4 < coord["lat"] < 15.6
    assert 66.9 < coord["lon"] < 67.1
    # Guards the swap in the direction the type system cannot: both are plausible floats.
    assert coord["lat"] != pytest.approx(coord["lon"])


def test_speckle_below_min_area_is_dropped():
    mask = np.zeros((64, 64), dtype=np.uint8)
    mask[5, 5] = OIL_SPILL_CLASS  # single-pixel speckle
    mask[20:40, 20:40] = OIL_SPILL_CLASS  # a real detection

    polygons = mask_to_polygons(
        mask,
        target_class=OIL_SPILL_CLASS,
        transform=_transform(),
        crs="EPSG:4326",
        min_area_px=25,
    )

    assert len(polygons) == 1


def test_empty_mask_returns_no_polygons():
    mask = np.zeros((32, 32), dtype=np.uint8)
    polygons = mask_to_polygons(
        mask, target_class=OIL_SPILL_CLASS, transform=_transform(), crs="EPSG:4326"
    )
    assert polygons == []
    assert largest_polygon(polygons) is None


def test_reprojection_from_metric_crs_preserves_lon_lat_order():
    """A projected source CRS is where an axis-order bug is most likely to slip in."""
    # UTM zone 42N, covering the Arabian Sea test area.
    transform = from_origin(500_000, 1_714_000, 10, 10)
    mask = _mask_with_block()

    polygons = mask_to_polygons(
        mask, target_class=OIL_SPILL_CLASS, transform=transform, crs="EPSG:32642"
    )
    wgs84 = to_wgs84(largest_polygon(polygons), "EPSG:32642")
    coord = centroid_coordinate(wgs84)

    assert -90 <= coord["lat"] <= 90
    assert 60 < coord["lon"] < 75, "longitude should land in UTM 42N's span, not be swapped"
    assert 10 < coord["lat"] < 20


def test_polygon_to_geojson_rejects_multipolygon():
    """The frozen contract carries one Polygon; a silent downgrade would lose oil."""
    from shapely.geometry import MultiPolygon

    multi = MultiPolygon([Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])])
    with pytest.raises(TypeError):
        polygon_to_geojson(multi)
