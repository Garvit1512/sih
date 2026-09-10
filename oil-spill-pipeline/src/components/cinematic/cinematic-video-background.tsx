"use client";

import { useEffect, useImperativeHandle, useRef, type RefObject } from "react";
import type { MotionValue } from "motion/react";

export interface CinematicClip {
  /** Public path, e.g. `/cinematic/hero.mp4`. */
  readonly src: string;
  /** Scroll range (0-1) this plate covers. */
  readonly range: readonly [number, number];
  /** Fraction of the range spent fading in/out against neighbours. */
  readonly fadeFraction?: number;
}

export interface CinematicVideoHandle {
  /** The underlying elements, in the order the clips were supplied. */
  readonly elements: ReadonlyArray<HTMLVideoElement | null>;
}

interface CinematicVideoBackgroundProps {
  clips: readonly CinematicClip[];
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
  /**
   * Called when the set of usable plates changes. The parent uses this to
   * decide whether the Three.js environment still needs to render.
   */
  onAvailabilityChange?: (available: boolean) => void;
  ref?: RefObject<CinematicVideoHandle | null>;
}

/** Don't re-seek for sub-frame deltas; seeking is the expensive part. */
const SEEK_EPSILON = 1 / 30;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * Opacity for one plate at a given scroll position. Fades happen strictly
 * inside the clip's own range, so neighbouring plates hand over cleanly
 * instead of both being visible at once.
 */
function clipOpacity(progress: number, clip: CinematicClip) {
  const [start, end] = clip.range;
  const span = Math.max(end - start, 0.0001);
  const fade = span * (clip.fadeFraction ?? 0.18);
  if (progress <= start || progress >= end) return 0;
  const fadeIn = smoothstep((progress - start) / fade);
  const fadeOut = 1 - smoothstep((progress - (end - fade)) / fade);
  return Math.min(fadeIn, fadeOut);
}

/**
 * Environmental cinematic layer: full-bleed video plates scrubbed by scroll
 * position, sitting behind the analytical Three.js objects and the HTML
 * narrative. Plates carry *environment only* — ocean, sky, weather, vessels
 * as filmed. Every label, confidence figure, track and marker stays in the
 * React/Three.js layers above, so the analysis is never baked into footage.
 *
 * Scrubbing is imperative and runs on its own rAF loop reading the scroll
 * MotionValue directly — no React state is touched per frame, so nothing
 * here re-renders while the user scrolls.
 *
 * If a plate is missing or fails to decode it is simply skipped; when no
 * plate is usable, `onAvailabilityChange(false)` lets the parent fall back
 * to the full Three.js environment.
 */
export function CinematicVideoBackground({
  clips,
  scrollYProgress,
  reducedMotion,
  onAvailabilityChange,
  ref,
}: CinematicVideoBackgroundProps) {
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const readyRef = useRef<boolean[]>([]);
  const lastSeekRef = useRef<number[]>([]);
  const availabilityRef = useRef(false);

  useImperativeHandle(ref, () => ({ elements: videoRefs.current }), []);

  const reportAvailability = () => {
    const available = readyRef.current.some(Boolean);
    if (available !== availabilityRef.current) {
      availabilityRef.current = available;
      onAvailabilityChange?.(available);
    }
  };

  // Imperative scrub loop. Deliberately not a useFrame/React subscription:
  // it writes straight to the DOM elements and never sets state.
  useEffect(() => {
    if (reducedMotion) return;

    let raf = 0;
    const tick = () => {
      const progress = scrollYProgress.get();

      clips.forEach((clip, index) => {
        const video = videoRefs.current[index];
        if (!video || !readyRef.current[index]) return;

        const opacity = clipOpacity(progress, clip);
        video.style.opacity = opacity.toFixed(3);

        // Only scrub the plate that's actually on screen.
        if (opacity <= 0.001) return;

        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        const [start, end] = clip.range;
        const local = clamp01((progress - start) / Math.max(end - start, 0.0001));
        const target = local * duration;

        if (Math.abs(target - (lastSeekRef.current[index] ?? -1)) > SEEK_EPSILON) {
          lastSeekRef.current[index] = target;
          try {
            video.currentTime = target;
          } catch {
            // A seek can throw if the element is torn down mid-frame; the
            // next tick will simply try again.
          }
        }
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clips, reducedMotion, scrollYProgress]);

  // Reduced motion: no scrubbing. Show a single representative frame from
  // each plate and leave it parked there.
  useEffect(() => {
    if (!reducedMotion) return;
    videoRefs.current.forEach((video, index) => {
      if (!video || !readyRef.current[index]) return;
      video.style.opacity = index === 0 ? "1" : "0";
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0) {
        try {
          video.currentTime = duration * 0.35;
        } catch {
          /* nothing to recover — the poster frame stays */
        }
      }
    });
  }, [reducedMotion, clips]);

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#05090f]">
      {clips.map((clip, index) => (
        <video
          key={clip.src}
          ref={(el) => {
            videoRefs.current[index] = el;
          }}
          src={clip.src}
          muted
          playsInline
          preload="metadata"
          // Autoplay only matters for the reduced-motion still; the scrub
          // loop drives currentTime directly the rest of the time.
          autoPlay={false}
          loop={false}
          controls={false}
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-200"
          onLoadedData={(event) => {
            readyRef.current[index] = true;
            // Park on a real frame so the first paint isn't black.
            const video = event.currentTarget;
            if (Number.isFinite(video.duration) && video.duration > 0) {
              try {
                video.currentTime = 0;
              } catch {
                /* ignore — the browser will show its own first frame */
              }
            }
            reportAvailability();
          }}
          onError={() => {
            readyRef.current[index] = false;
            reportAvailability();
          }}
        />
      ))}
    </div>
  );
}

/**
 * Default plate set. These paths are expected to be supplied later — see
 * `public/cinematic/README.md`. Until the files exist every plate errors,
 * availability stays false, and the Three.js environment renders instead.
 */
export const DEFAULT_CINEMATIC_CLIPS: readonly CinematicClip[] = [
  { src: "/cinematic/hero.mp4", range: [0, 0.15] },
  { src: "/cinematic/sar.mp4", range: [0.15, 0.42] },
  { src: "/cinematic/slick.mp4", range: [0.42, 0.7] },
  { src: "/cinematic/ais.mp4", range: [0.7, 1] },
];
