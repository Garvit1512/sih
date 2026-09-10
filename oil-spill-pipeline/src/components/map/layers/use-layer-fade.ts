"use client";

import { useEffect, useState } from "react";

/**
 * Drives a Mapbox paint-property fade.
 *
 * Mapbox interpolates paint properties when they change, so a layer that
 * mounts at opacity 0 and is set to its target on the next frame fades in
 * rather than popping. Returns a 0..1 multiplier to apply to each opacity.
 *
 * Under `prefers-reduced-motion` the layer is simply on or off — pass
 * `instant` to skip the transition without changing what is drawn.
 */
export function useLayerFade(visible: boolean, instant = false): number {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!visible) {
      setOn(false);
      return;
    }
    if (instant) {
      setOn(true);
      return;
    }
    const frame = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(frame);
  }, [visible, instant]);

  return on ? 1 : 0;
}
