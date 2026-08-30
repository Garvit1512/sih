"""Loads and queries the Stage B infrastructure dataset (platforms + pipelines).

Data source: a small, hand-verified static GeoJSON dataset (PRD §16/CLAUDE.md §15) —
used because public coverage (Global Energy Monitor / OpenStreetMap) for the demo region
has not yet been vetted for this project. See data/README.md for provenance of every
feature. This fallback must keep working even if no external data source is ever wired
up — the dataset is checked into the repo, not fetched at runtime.

Distances are computed geodesically (pyproj.Geod, WGS84 ellipsoid) rather than as planar
degree differences, per PRD §48's degrees-vs-metres warning. Point-to-line distance uses
shapely's planar `nearest_points` to find the closest vertex/segment point on the
pipeline geometry, then measures the geodesic distance from the origin to that point —
an approximation that is accurate at the km scale relevant to this triage check, but not
appropriate for continental-scale distances.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from pyproj import Geod
from shapely.geometry import LineString, Point, shape

from app.schemas.common import Coordinate

_GEOD = Geod(ellps="WGS84")


@dataclass(frozen=True)
class NearestFeature:
    """Raw nearest-feature lookup. Threshold comparison (`nearby`) is Stage B business
    logic and is applied by the caller (triage_service), not here."""

    distance_km: float | None
    id: str | None
    name: str | None
    location: Coordinate | None


@dataclass(frozen=True)
class PlatformFeature:
    id: str
    name: str
    location: Coordinate


@dataclass(frozen=True)
class PipelineFeature:
    id: str
    name: str
    geometry: LineString


@dataclass(frozen=True)
class InfrastructureDataset:
    platforms: list[PlatformFeature]
    pipelines: list[PipelineFeature]


def load_infrastructure(data_dir: Path) -> InfrastructureDataset:
    platforms_path = data_dir / "platforms.geojson"
    pipelines_path = data_dir / "pipelines.geojson"

    platforms = [
        PlatformFeature(
            id=feature["properties"]["id"],
            name=feature["properties"]["name"],
            location=Coordinate(lat=feature["geometry"]["coordinates"][1],
                                 lon=feature["geometry"]["coordinates"][0]),
        )
        for feature in _read_geojson_features(platforms_path)
    ]

    pipelines = [
        PipelineFeature(
            id=feature["properties"]["id"],
            name=feature["properties"]["name"],
            geometry=shape(feature["geometry"]),
        )
        for feature in _read_geojson_features(pipelines_path)
    ]

    return InfrastructureDataset(platforms=platforms, pipelines=pipelines)


def _read_geojson_features(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        collection = json.load(f)
    return collection["features"]


def _geodesic_distance_km(a: Coordinate, b_lon: float, b_lat: float) -> float:
    _, _, distance_m = _GEOD.inv(a.lon, a.lat, b_lon, b_lat)
    return distance_m / 1000.0


def nearest_platform(origin: Coordinate, platforms: list[PlatformFeature]) -> NearestFeature:
    if not platforms:
        return NearestFeature(distance_km=None, id=None, name=None, location=None)

    closest = min(
        platforms,
        key=lambda p: _geodesic_distance_km(origin, p.location.lon, p.location.lat),
    )
    distance_km = _geodesic_distance_km(origin, closest.location.lon, closest.location.lat)
    return NearestFeature(
        distance_km=distance_km,
        id=closest.id,
        name=closest.name,
        location=closest.location,
    )


def nearest_pipeline(origin: Coordinate, pipelines: list[PipelineFeature]) -> NearestFeature:
    if not pipelines:
        return NearestFeature(distance_km=None, id=None, name=None, location=None)

    origin_point = Point(origin.lon, origin.lat)

    def distance_to(pipeline: PipelineFeature) -> float:
        nearest_point_on_line = pipeline.geometry.interpolate(
            pipeline.geometry.project(origin_point)
        )
        return _geodesic_distance_km(origin, nearest_point_on_line.x, nearest_point_on_line.y)

    closest = min(pipelines, key=distance_to)
    return NearestFeature(
        distance_km=distance_to(closest),
        id=closest.id,
        name=closest.name,
        location=None,  # pipelines are lines, not points
    )
