"use client";

import { useCallback, useState } from "react";
import { ReactLenis } from "lenis/react";
import { cn } from "@/lib/utils";
import { manropeFont, jetbrainsMono } from "@/lib/fonts";
import { useCinematicScroll } from "@/hooks/use-cinematic-scroll";
import { CinematicScene } from "@/components/cinematic/cinematic-scene";
import { CinematicOverlay } from "@/components/cinematic/cinematic-overlay";
import { InvestigationTimeline } from "@/components/cinematic/investigation-timeline";
import {
  CinematicVideoBackground,
  DEFAULT_CINEMATIC_CLIPS,
} from "@/components/cinematic/cinematic-video-background";
import { CINEMATIC_SCROLL_VH } from "@/components/cinematic/stages";

/**
 * Top-level orchestrator for the `/` cinematic experience.
 *
 * Layer stack, back to front:
 *   1. cinematic video plates (environment, scroll-scrubbed)
 *   2. atmospheric overlay (depth + text legibility)
 *   3. Three.js analytical objects (transparent canvas)
 *   4. HTML narrative overlay
 *
 * The environment is whichever of the first or third layer is available:
 * when the plates load, the Three.js environment (ocean, sky, hero vessel,
 * satellite) stands down and only the analytical geometry composites over
 * the footage. When the plates are missing — which is the case until they
 * are dropped into `public/cinematic/` — the full procedural scene renders
 * exactly as before. Nothing breaks either way.
 */
export function CinematicExperience() {
  const { containerRef, scrollYProgress, reducedMotion } = useCinematicScroll();
  const [videoAvailable, setVideoAvailable] = useState(false);

  const handleAvailability = useCallback((available: boolean) => {
    setVideoAvailable(available);
  }, []);

  const content = (
    <div
      className={cn(
        manropeFont.className,
        jetbrainsMono.variable,
        "relative bg-[#05090f] text-white"
      )}
    >
      <div
        ref={containerRef}
        style={{ height: `${CINEMATIC_SCROLL_VH}vh` }}
        className="relative"
      >
        <div className="sticky top-0 h-dvh w-full overflow-hidden">
          {/* 1 — environment plates */}
          <CinematicVideoBackground
            clips={DEFAULT_CINEMATIC_CLIPS}
            scrollYProgress={scrollYProgress}
            reducedMotion={reducedMotion}
            onAvailabilityChange={handleAvailability}
          />

          {/* 2 — atmospheric overlay: a little depth, and enough of a floor
              under the narrative text to stay legible over live footage. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: videoAvailable
                ? "radial-gradient(ellipse at 50% 45%, rgba(5,9,15,0.15) 0%, rgba(5,9,15,0.62) 100%)"
                : "radial-gradient(ellipse at 50% 45%, rgba(5,9,15,0) 55%, rgba(5,9,15,0.4) 100%)",
            }}
          />

          {/* 3 — analytical geometry (canvas is transparent) */}
          <div className="absolute inset-0">
            <CinematicScene
              scrollYProgress={scrollYProgress}
              reducedMotion={reducedMotion}
              environmentMode={videoAvailable ? "video" : "webgl"}
            />
          </div>

          {/* 4 — narrative */}
          <CinematicOverlay
            scrollYProgress={scrollYProgress}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>

      <InvestigationTimeline scrollYProgress={scrollYProgress} />
    </div>
  );

  if (reducedMotion) {
    return content;
  }

  return (
    <ReactLenis root options={{ smoothWheel: true, syncTouch: false }}>
      {content}
    </ReactLenis>
  );
}
