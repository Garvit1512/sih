"use client";

import { motion } from "motion/react";
import { Navigation } from "lucide-react";
import { bearing as turfBearing } from "@turf/turf";
import type { Feature, Point } from "geojson";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";

/**
 * Ruled-out infrastructure that is too far away to be in frame.
 *
 * "The nearest platform is 478 km away" is the evidence that makes a vessel
 * hypothesis stand up, but at that distance it cannot be drawn without losing
 * the slick. This is the instrument reading instead: the backend's own
 * distance, and a bearing derived from the two real positions it reported.
 */
export function InfrastructureBearing({
  origin,
  platform,
  distanceKm,
  name,
  visible,
  reducedMotion,
}: {
  origin: Feature<Point> | null;
  platform: Feature<Point> | null;
  distanceKm: number | null;
  name: string | null;
  visible: boolean;
  reducedMotion: boolean;
}) {
  if (!visible || !origin || !platform || distanceKm === null) return null;

  const raw = turfBearing(origin, platform);
  const heading = Math.round((raw + 360) % 360);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
      className="flex items-center gap-2 rounded-sm border border-white/[0.08] bg-[#0b0f16]/80 px-2.5 py-1.5 backdrop-blur-[2px]"
    >
      <Navigation
        className="size-3 shrink-0 text-white/45"
        style={{ transform: `rotate(${heading}deg)` }}
        aria-hidden
      />
      <span className={cn("text-[10px] text-white/55", jetbrainsMono.className)}>
        {name ?? "Nearest platform"} · {distanceKm.toFixed(1)} km ·{" "}
        {String(heading).padStart(3, "0")}°
      </span>
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-white/28">
        out of frame
      </span>
    </motion.div>
  );
}
