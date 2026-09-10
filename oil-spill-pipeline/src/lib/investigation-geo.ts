/**
 * Turns the backend's `InvestigationCase` into GeoJSON the map can draw.
 *
 * Every geometry here is passed through from the API response — the backend
 * already emits GeoJSON in [lon, lat] order (parent CLAUDE.md §9), so nothing
 * is re-ordered, re-projected or invented. Where the contract carries no
 * geometry (vessel candidates have no position in `AttributionResult`), this
 * module returns `null` rather than fabricating one (parent CLAUDE.md §70/§71).
 */

import type { Feature, LineString, Point, Polygon, Position } from "geojson";
import type {
  Coordinate,
  DetectionResult,
  DriftResult,
  TriageResult,
} from "@/types/investigation";

/** `[[west, south], [east, north]]`, the shape `map.fitBounds` expects. */
export type MapBounds = [[number, number], [number, number]];

/** `{lat, lon}` API coordinate -> GeoJSON `[lon, lat]`. Never inline this by hand. */
export function toPosition(coordinate: Coordinate): Position {
  return [coordinate.lon, coordinate.lat];
}

export function spillPolygonFeature(
  detection: DetectionResult | null | undefined
): Feature<Polygon> | null {
  if (!detection) return null;
  return {
    type: "Feature",
    properties: { kind: "spill" },
    geometry: detection.spill.polygon,
  };
}

export function spillCentroidFeature(
  detection: DetectionResult | null | undefined
): Feature<Point> | null {
  if (!detection) return null;
  return {
    type: "Feature",
    properties: { kind: "centroid" },
    geometry: { type: "Point", coordinates: toPosition(detection.spill.centroid) },
  };
}

export function originFeature(
  drift: DriftResult | null | undefined
): Feature<Point> | null {
  if (!drift) return null;
  return {
    type: "Feature",
    properties: { kind: "origin" },
    geometry: { type: "Point", coordinates: toPosition(drift.hindcast.origin) },
  };
}

/**
 * The backward-drift path, reversed.
 *
 * The contract stores the hindcast running origin -> current slick. The
 * investigator reads it the other way (from what was observed, back to where
 * it came from), so the drawn line runs slick -> origin. Same vertices, same
 * values, only the traversal order changes.
 */
export function hindcastFeature(
  drift: DriftResult | null | undefined
): Feature<LineString> | null {
  if (!drift) return null;
  const coordinates = [...drift.hindcast.path.coordinates].reverse();
  if (coordinates.length < 2) return null;
  return {
    type: "Feature",
    properties: { kind: "hindcast" },
    geometry: { type: "LineString", coordinates },
  };
}

export function forecastFeature(
  drift: DriftResult | null | undefined
): Feature<LineString> | null {
  if (!drift || drift.forecast.path.coordinates.length < 2) return null;
  return {
    type: "Feature",
    properties: { kind: "forecast" },
    geometry: drift.forecast.path,
  };
}

/**
 * The platform the triage engine actually measured against, when it gave one
 * a position. `InfrastructureEvidence.location` is null for pipelines (the
 * nearest point on a line isn't part of the frozen contract), so pipeline
 * geometry comes from the checked-in dataset instead — see
 * `useInfrastructureGeometry`.
 */
export function nearestPlatformFeature(
  triage: TriageResult | null | undefined
): Feature<Point> | null {
  const platform = triage?.evidence.platform;
  if (!platform?.location) return null;
  return {
    type: "Feature",
    properties: {
      kind: "platform",
      id: platform.id ?? "",
      name: platform.name ?? platform.id ?? "Platform",
      distance_km: platform.distance_km,
      nearby: platform.nearby,
    },
    geometry: { type: "Point", coordinates: toPosition(platform.location) },
  };
}

/* ------------------------------------------------------------------ */
/* Bounds                                                              */
/* ------------------------------------------------------------------ */

function extendBounds(bounds: MapBounds | null, position: Position): MapBounds {
  const [lon, lat] = position;
  if (!bounds) return [[lon, lat], [lon, lat]];
  return [
    [Math.min(bounds[0][0], lon), Math.min(bounds[0][1], lat)],
    [Math.max(bounds[1][0], lon), Math.max(bounds[1][1], lat)],
  ];
}

function collectPositions(geometry: Polygon | LineString | Point): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "LineString":
      return geometry.coordinates;
    case "Polygon":
      return geometry.coordinates.flat();
  }
}

/** Union bounds of every supplied feature; `null` when nothing is drawable. */
export function boundsOfFeatures(
  features: ReadonlyArray<Feature<Polygon | LineString | Point> | null>
): MapBounds | null {
  let bounds: MapBounds | null = null;
  for (const feature of features) {
    if (!feature) continue;
    for (const position of collectPositions(feature.geometry)) {
      bounds = extendBounds(bounds, position);
    }
  }
  return bounds;
}

/**
 * Grows a degenerate or very tight box so `fitBounds` doesn't slam the camera
 * to max zoom on a single point. Purely a camera concern — no geometry that
 * the investigator sees is altered.
 */
export function padBounds(bounds: MapBounds, minimumSpanDegrees: number): MapBounds {
  const lonSpan = bounds[1][0] - bounds[0][0];
  const latSpan = bounds[1][1] - bounds[0][1];
  const lonPad = Math.max(0, (minimumSpanDegrees - lonSpan) / 2);
  const latPad = Math.max(0, (minimumSpanDegrees - latSpan) / 2);
  return [
    [bounds[0][0] - lonPad, bounds[0][1] - latPad],
    [bounds[1][0] + lonPad, bounds[1][1] + latPad],
  ];
}
