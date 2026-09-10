/** Pure math helpers shared by the camera rig and 3D narrative elements. */

export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Opacity curve for a stage's scroll range: fades in just before the range
 * starts, holds through it, and — unless `holdAfter` — fades back out just
 * after it ends.
 */
export function stageOpacity(
  progress: number,
  range: readonly [number, number],
  fade = 0.04,
  holdAfter = true
): number {
  const [start, end] = range;
  const fadeIn = smoothstep((progress - (start - fade)) / fade);
  if (holdAfter) return fadeIn;
  const fadeOut = 1 - smoothstep((progress - (end + fade)) / fade);
  return Math.min(fadeIn, fadeOut);
}
