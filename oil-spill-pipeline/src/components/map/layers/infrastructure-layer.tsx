"use client";

import { Layer, Source } from "react-map-gl/mapbox";
import type { Feature, LineString } from "geojson";
import { useLayerFade } from "./use-layer-fade";

const TRANSITION = { duration: 900, delay: 0 };

/**
 * A mapped pipeline route the Stage B triage engine measured against.
 *
 * `nearby` is the backend's flag, not a client-side comparison — it only
 * decides how strongly the route is drawn. The route that was ruled *out* is
 * still shown when it is in frame, because "the nearest pipeline is 47 km
 * away" is itself evidence (parent CLAUDE.md §18).
 */
export function PipelineLayer({
  feature,
  nearby,
  visible,
  instant = false,
}: {
  feature: Feature<LineString> | null;
  nearby: boolean;
  visible: boolean;
  instant?: boolean;
}) {
  const fade = useLayerFade(visible, instant);
  if (!feature) return null;

  return (
    <Source id="pipeline-source" type="geojson" data={feature}>
      <Layer
        id="pipeline-casing"
        type="line"
        layout={{ "line-cap": "round" }}
        paint={{
          "line-color": "#05070a",
          "line-width": nearby ? 5 : 3.5,
          "line-opacity": 0.55 * fade,
          "line-opacity-transition": TRANSITION,
        }}
      />
      <Layer
        id="pipeline-layer"
        type="line"
        layout={{ "line-cap": "round" }}
        paint={{
          "line-color": nearby ? "#D8A34E" : "#8FA3B8",
          "line-width": nearby ? 2 : 1.4,
          "line-opacity": (nearby ? 0.95 : 0.5) * fade,
          "line-opacity-transition": TRANSITION,
          "line-dasharray": [3, 2],
        }}
      />
    </Source>
  );
}
