"use client";

import { useEffect, useRef, useState } from "react";
import {
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";

/**
 * QA override: `/?p=0.55` pins the sequence at a fixed scroll fraction so a
 * single beat can be inspected or captured. Read once, synchronously, so the
 * pinned value replaces the scroll source outright rather than competing
 * with it frame by frame.
 */
function readPinnedProgress(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("p");
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

/**
 * Drives the cinematic `/` sequence off one tall scroll container. Returns a
 * `scrollYProgress` MotionValue (0-1) that the camera rig, 3D scene elements,
 * and HTML overlays all read from — keeping them in sync without causing
 * React re-renders on every scroll tick (oil-spill-pipeline/CLAUDE.md §8).
 */
export function useCinematicScroll() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const prefersReducedMotion = useReducedMotion();

  // Read once, via a state initialiser. Motion only repaints `style`-bound
  // values on its own frame loop, so a post-mount `.set()` would leave the
  // overlays showing stage 0 — the value has to be right from first render.
  // Only ever active on the debug `?p=` URL.
  const [pinned] = useState<number | null>(() => readPinnedProgress());
  const pinnedProgress = useMotionValue(pinned ?? 0);

  return {
    containerRef,
    scrollYProgress: pinned === null ? scrollYProgress : pinnedProgress,
    reducedMotion: Boolean(prefersReducedMotion),
  };
}

/**
 * Mirrors a scroll-progress MotionValue into a plain ref, for R3F components
 * that need to read it inside `useFrame` without subscribing React state to
 * every scroll tick.
 */
export function useScrollProgressRef(scrollYProgress: MotionValue<number>) {
  const progressRef = useRef(scrollYProgress.get());

  useEffect(() => {
    progressRef.current = scrollYProgress.get();
    return scrollYProgress.on("change", (value) => {
      progressRef.current = value;
    });
  }, [scrollYProgress]);

  return progressRef;
}

/**
 * Clamps each value to [0, 1] and then forces the sequence non-decreasing
 * (via a running max). `scrollYProgress` only ever ranges over [0, 1], but
 * a stage's fade-padded breakpoints (`start - fade`, `end + fade`) can fall
 * outside that domain — e.g. the opening stage starts at 0, so `start -
 * fade` is negative. Motion can drive a scroll-linked `style` binding like
 * this through the native Web Animations API, which takes these breakpoints
 * directly as keyframe `offset`s; WAAPI requires every offset to be within
 * [0, 1] and non-decreasing (duplicates are fine), so an out-of-range value
 * throws "Offsets must be monotonically non-decreasing" at scroll time
 * instead of failing at build/typecheck time. Normalizing here keeps every
 * input range provably valid, in both scroll directions, however `fade` or
 * a stage's `range` is configured.
 */
function toValidOffsets(values: readonly number[]): number[] {
  let last = 0;
  return values.map((value) => {
    const clamped = Math.min(1, Math.max(0, value));
    const nonDecreasing = Math.max(clamped, last);
    last = nonDecreasing;
    return nonDecreasing;
  });
}

/**
 * Crossfade + gentle vertical drift for one narrative section's overlay.
 *
 * Every fade happens strictly INSIDE the stage's own scroll range, so a
 * stage is fully transparent at both its boundaries. Consecutive stages
 * share a boundary, which means two narrative overlays can never be legible
 * at the same time — the previous one has finished fading out exactly where
 * the next one begins fading in. This is a structural guarantee, not a
 * hand-tuned set of numbers that has to be re-checked whenever a range
 * moves.
 *
 * `holdBefore` starts the stage already visible (the hero, which must be
 * fully readable at scroll position zero); `holdAfter` keeps it visible
 * once reached (the closing CTA).
 */
export function useStageOverlayStyle(
  scrollYProgress: MotionValue<number>,
  range: readonly [number, number],
  options?: {
    /** Fraction of the stage's span spent fading, per edge. */
    fadeFraction?: number;
    holdBefore?: boolean;
    holdAfter?: boolean;
    reducedMotion?: boolean;
  }
) {
  const {
    fadeFraction = 0.25,
    holdBefore = false,
    holdAfter = false,
    reducedMotion = false,
  } = options ?? {};

  const [start, end] = range;
  const span = Math.max(end - start, 0.0001);
  const fade = span * fadeFraction;
  const fadeInEnd = start + fade;
  const fadeOutStart = end - fade;

  const opacityInput = toValidOffsets(
    holdBefore
      ? [start, fadeOutStart, end]
      : holdAfter
        ? [start, fadeInEnd, 1]
        : [start, fadeInEnd, fadeOutStart, end]
  );
  const opacityOutput = holdBefore
    ? [1, 1, 0]
    : holdAfter
      ? [0, 1, 1]
      : [0, 1, 1, 0];

  const opacity = useTransform(scrollYProgress, opacityInput, opacityOutput);

  const yInput = toValidOffsets([start, fadeInEnd, fadeOutStart, end]);
  const y = useTransform(
    scrollYProgress,
    yInput,
    reducedMotion ? [0, 0, 0, 0] : [18, 0, 0, -18]
  );

  return { opacity, y };
}
