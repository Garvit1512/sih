"use client";

import { Layer, Source } from "react-map-gl/mapbox";
import type { Feature, Polygon } from "geojson";
import { useLayerFade } from "./use-layer-fade";

const FILL_OPACITY = 0.16;
const OUTLINE_OPACITY = 0.85;
const TRANSITION = { duration: 900, delay: 0 };

/**
 * The Stage A slick footprint — the backend's own polygon, drawn as-is.
 *
 * Deliberately restrained: a low-opacity fill and a thin boundary, so the
 * detection reads as a measured extent rather than a highlight effect.
 */
export function DetectionLayer({
  feature,
  visible,
  instant = false,
}: {
  feature: Feature<Polygon> | null;
  visible: boolean;
  instant?: boolean;
}) {
  const fade = useLayerFade(visible, instant);
  if (!feature) return null;

  return (
    <Source id="spill-source" type="geojson" data={feature}>
      <Layer
        id="spill-fill"
        type="fill"
        paint={{
          "fill-color": "#4FB8D9",
          "fill-opacity": FILL_OPACITY * fade,
          "fill-opacity-transition": TRANSITION,
        }}
      />
      <Layer
        id="spill-outline"
        type="line"
        paint={{
          "line-color": "#7FD3E6",
          "line-width": 1.4,
          "line-opacity": OUTLINE_OPACITY * fade,
          "line-opacity-transition": TRANSITION,
        }}
      />
    </Source>
  );
}
