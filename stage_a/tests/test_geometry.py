"""Stage 9 tests — measurements must be metric, not degree-based.

Each assertion below is checked against an analytically-known value rather than against
whatever the code happens to return, because the failure mode here (square degrees
reported as km²) produces numbers that look entirely reasonable.
"""

from __future__ import annotations

import pytest
from shapely.geometry import LineString, Polygon

from stage_a.geometry import (
    compute_area_km2,
    compute_coastline_distance_km,
    compute_elongation,
    compute_perimeter_km,
    extract_properties,
)

# At the equator 1 degree of latitude is ~110.57 km and 1 degree of longitude ~111.32 km.
KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LON_AT_EQUATOR = 111.320


def _square(lon0=0.0, lat0=0.0, size_deg=0.1) -> Polygon:
    return Polygon(
        [
            (lon0, lat0),
            (lon0 + size_deg, lat0),
            (lon0 + size_deg, lat0 + size_deg),
            (lon0, lat0 + size_deg),
        ]
    )


def test_area_is_square_kilometres_not_square_degrees():
    square = _square(size_deg=0.1)
    expected = (0.1 * KM_PER_DEG_LAT) * (0.1 * KM_PER_DEG_LON_AT_EQUATOR)

    area = compute_area_km2(square)

    assert area == pytest.approx(expected, rel=0.02)
    # The bug this guards: shapely's raw .area on degrees would be 0.01.
    assert area > 100


def test_perimeter_is_kilometres():
    square = _square(size_deg=0.1)
    expected = 2 * (0.1 * KM_PER_DEG_LAT) + 2 * (0.1 * KM_PER_DEG_LON_AT_EQUATOR)

    assert compute_perimeter_km(square) == pytest.approx(expected, rel=0.02)


def test_area_at_high_latitude_accounts_for_longitude_convergence():
    """The same degree-extent box is physically smaller far from the equator."""
    equator = compute_area_km2(_square(lat0=0.0, size_deg=0.1))
    high_lat = compute_area_km2(_square(lat0=60.0, size_deg=0.1))

    # cos(60 deg) = 0.5, so the high-latitude box should be roughly half the area.
    assert high_lat == pytest.approx(equator * 0.5, rel=0.05)


def test_elongation_of_a_square_is_about_one():
    assert compute_elongation(_square(size_deg=0.1)) == pytest.approx(1.0, abs=0.05)


def test_elongation_detects_a_stretched_slick():
    # 0.4 deg of longitude by 0.05 deg of latitude, near the equator.
    stretched = Polygon([(0, 0), (0.4, 0), (0.4, 0.05), (0, 0.05)])
    expected_ratio = (0.4 * KM_PER_DEG_LON_AT_EQUATOR) / (0.05 * KM_PER_DEG_LAT)

    assert compute_elongation(stretched) == pytest.approx(expected_ratio, rel=0.05)


def test_coastline_distance_is_none_when_no_coastline_supplied():
    """Missing data is None, never 0.0 (CLAUDE.md §70)."""
    assert compute_coastline_distance_km(_square()) is None


def test_coastline_distance_is_measured_in_kilometres():
    spill = _square(lon0=0.0, lat0=0.0, size_deg=0.1)
    coastline = LineString([(0.5, -1.0), (0.5, 1.0)])  # ~0.4 deg east of the spill's edge

    distance = compute_coastline_distance_km(spill, coastline)

    assert distance == pytest.approx(0.4 * KM_PER_DEG_LON_AT_EQUATOR, rel=0.05)


def test_extract_properties_returns_the_full_contract_property_set():
    props = extract_properties(_square(lon0=67.0, lat0=15.0, size_deg=0.05))

    assert props.area_km2 > 0
    assert props.perimeter_km > 0
    assert props.elongation >= 1.0
    assert 15.0 < props.centroid_lat < 15.1
    assert 67.0 < props.centroid_lon < 67.1
    assert props.coastline_distance_km is None
