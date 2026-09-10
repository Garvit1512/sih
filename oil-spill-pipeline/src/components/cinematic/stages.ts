/**
 * Shared narrative configuration for the cinematic `/` experience
 * (oil-spill-pipeline/CLAUDE.md §7). Scroll progress (0-1 across the tall
 * scroll container) drives both the camera rig and the HTML overlays off
 * these same ranges, so they stay in sync.
 *
 * Sample/fictional data only — no backend integration (Phase 3 scope).
 */

export interface CinematicStage {
  readonly id: string;
  readonly index: number;
  readonly label: string;
  /** [start, end] scroll progress, 0-1. */
  readonly range: readonly [number, number];
}

export const CINEMATIC_STAGES: readonly CinematicStage[] = [
  { id: "ocean", index: 0, label: "Ocean", range: [0, 0.15] },
  { id: "sar", index: 1, label: "SAR Acquisition", range: [0.15, 0.28] },
  { id: "slick", index: 2, label: "Slick Detection", range: [0.28, 0.42] },
  { id: "rule-out", index: 3, label: "Rule-Out", range: [0.42, 0.55] },
  { id: "drift", index: 4, label: "Backward Drift", range: [0.55, 0.7] },
  { id: "ais", index: 5, label: "AIS Lineup", range: [0.7, 0.84] },
  { id: "verdict", index: 6, label: "Verdict", range: [0.84, 0.94] },
  { id: "workspace", index: 7, label: "Investigation Workspace", range: [0.94, 1] },
] as const;

export function stageById(id: string): CinematicStage {
  const stage = CINEMATIC_STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`Unknown cinematic stage: ${id}`);
  return stage;
}

/** Total scroll length of the cinematic sequence, in viewport heights. */
export const CINEMATIC_SCROLL_VH = 800;

export interface CameraKeyframe {
  readonly t: number;
  readonly position: readonly [number, number, number];
  readonly lookAt: readonly [number, number, number];
  readonly fov: number;
}

/**
 * Camera path keyframes, one per stage start plus a closing frame.
 *
 * The opening sits low over the water with a slight downward tilt, which
 * puts the horizon in the upper third and lets the ocean dominate the frame
 * (the moon sits off to the left, so its reflection path runs toward the
 * camera). From there the rig rises steadily: down onto the slick, across to
 * the exclusion markers, up for the drift reconstruction, higher still for
 * the AIS lineup, and finally back to an analytical overview.
 */
export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
  // OCEAN — low over the water, horizon in the upper third, hero vessel
  // right of centre and the moon off to the left.
  { t: 0, position: [0, 2.8, 9], lookAt: [-3, -0.6, -26], fov: 52 },
  // SAR — rises and turns toward the pass; satellite upper frame, ship
  // centre, acquisition footprint low in frame.
  { t: 0.15, position: [2, 8, 16], lookAt: [11, 9, -22], fov: 52 },
  // SLICK — drops back toward the surface, slick centred, ship distant.
  { t: 0.28, position: [7, 11, 11], lookAt: [2, 0, -7], fov: 46 },
  // RULE-OUT — medium altitude, swung left onto the exclusion markers.
  { t: 0.42, position: [-4, 12, 10], lookAt: [-6, 0, -6], fov: 45 },
  // DRIFT — rises substantially; the sea starts reading as an analytical
  // surface with the hindcast corridor laid across it.
  { t: 0.55, position: [6, 20, 18], lookAt: [8, 0, -8], fov: 44 },
  // AIS — high overview, contacts and tracks spread around the slick.
  { t: 0.7, position: [6, 27, 26], lookAt: [11, 0, -12], fov: 44 },
  // VERDICT — stable analytical overview of all the evidence at once.
  { t: 0.84, position: [6, 33, 34], lookAt: [12, 0, -14], fov: 42 },
  // WORKSPACE — final pullback before handing off to /investigate.
  { t: 1, position: [6, 42, 44], lookAt: [12, 0, -16], fov: 40 },
] as const;

/** World-space center used by the slick / drift / AIS scene elements. */
export const SLICK_ORIGIN: readonly [number, number, number] = [2, 0, -6];
