"use client";

import { useEffect, useState } from "react";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";

/**
 * Loads the checked-in infrastructure geometry served from `/data/infrastructure`.
 *
 * This is display geometry only. Every distance, `nearby` flag and hypothesis
 * still comes from the backend's Stage B response — see the README beside the
 * files. A missing or malformed file degrades to "nothing drawn"; it never
 * blocks the investigation (parent CLAUDE.md §41).
 */
export interface InfrastructureGeometry {
  readonly platforms: FeatureCollection<Point> | null;
  readonly pipelines: FeatureCollection<LineString> | null;
}

const EMPTY: InfrastructureGeometry = { platforms: null, pipelines: null };

async function loadCollection<T extends Point | LineString>(
  path: string,
  signal: AbortSignal
): Promise<FeatureCollection<T> | null> {
  try {
    const response = await fetch(path, { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as FeatureCollection<T>;
    return body?.type === "FeatureCollection" && Array.isArray(body.features)
      ? body
      : null;
  } catch {
    return null;
  }
}

export function useInfrastructureGeometry(): InfrastructureGeometry {
  const [geometry, setGeometry] = useState<InfrastructureGeometry>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const [platforms, pipelines] = await Promise.all([
        loadCollection<Point>("/data/infrastructure/platforms.geojson", controller.signal),
        loadCollection<LineString>("/data/infrastructure/pipelines.geojson", controller.signal),
      ]);
      if (!controller.signal.aborted) setGeometry({ platforms, pipelines });
    })();
    return () => controller.abort();
  }, []);

  return geometry;
}

/** The one feature whose `id` the backend's triage evidence actually named. */
export function findFeatureById<T extends Point | LineString>(
  collection: FeatureCollection<T> | null,
  id: string | null | undefined
): Feature<T> | null {
  if (!collection || !id) return null;
  return (
    collection.features.find((feature) => feature.properties?.id === id) ?? null
  );
}
