"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source } from "react-map-gl/mapbox";
import { length as turfLength, lineSliceAlong } from "@turf/turf";
import type { Feature, LineString } from "geojson";
import { useLayerFade } from "./use-layer-fade";

const TRANSITION = { duration: 700, delay: 0 };

/**
 * Progressively reveals a line by slicing it with Turf.
 *
 * The vertices are the backend's; only how much of the line has been drawn
 * changes over time. Slicing (rather than interpolating by hand) keeps the
 * drawn geometry on the real path — parent CLAUDE.md §48.
 */
function useLineReveal(
  feature: Feature<LineString> | null,
  active: boolean,
  durationMs: number,
  instant: boolean
): Feature<LineString> | null {
  const [progress, setProgress] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!feature || !active) {
      setProgress(0);
      return;
    }
    if (instant) {
      setProgress(1);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const ratio = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — the trace decelerates as it settles on the origin.
      setProgress(1 - Math.pow(1 - ratio, 3));
      if (ratio < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [feature, active, durationMs, instant]);

  return useMemo(() => {
    if (!feature || progress <= 0) return null;
    if (progress >= 1) return feature;
    const total = turfLength(feature, { units: "kilometers" });
    if (!Number.isFinite(total) || total <= 0) return feature;
    try {
      return lineSliceAlong(feature, 0, total * progress, { units: "kilometers" });
    } catch {
      // A degenerate slice is not worth failing the phase over.
      return feature;
    }
  }, [feature, progress]);
}

/**
 * The Stage C hindcast, traced backwards from the observed slick to the
 * probable origin. Values are the backend's; the tracing is presentation.
 */
export function HindcastLayer({
  feature,
  visible,
  instant = false,
  durationMs = 2600,
}: {
  feature: Feature<LineString> | null;
  visible: boolean;
  instant?: boolean;
  durationMs?: number;
}) {
  const revealed = useLineReveal(feature, visible, durationMs, instant);
  if (!revealed) return null;

  return (
    <Source id="hindcast-source" type="geojson" data={revealed}>
      <Layer
        id="hindcast-glow"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": "#4FB8D9", "line-width": 7, "line-blur": 6, "line-opacity": 0.28 }}
      />
      <Layer
        id="hindcast-line"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": "#8FDCEF", "line-width": 1.8, "line-opacity": 0.95 }}
      />
    </Source>
  );
}

/** The Stage C forward forecast — dashed, to read as projection, not history. */
export function ForecastLayer({
  feature,
  visible,
  instant = false,
}: {
  feature: Feature<LineString> | null;
  visible: boolean;
  instant?: boolean;
}) {
  const fade = useLayerFade(visible, instant);
  if (!feature) return null;

  return (
    <Source id="forecast-source" type="geojson" data={feature}>
      <Layer
        id="forecast-line"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": "#D8A34E",
          "line-width": 1.6,
          "line-dasharray": [2, 2.5],
          "line-opacity": 0.8 * fade,
          "line-opacity-transition": TRANSITION,
        }}
      />
    </Source>
  );
}
