"use client";

import { Marker } from "react-map-gl/mapbox";
import { motion } from "motion/react";
import type { Feature, Point } from "geojson";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";

export type MarkerKind = "centroid" | "origin" | "platform";

interface MarkerLayerProps {
  centroid: Feature<Point> | null;
  origin: Feature<Point> | null;
  platform: Feature<Point> | null;
  showCentroid: boolean;
  showOrigin: boolean;
  showPlatform: boolean;
  /** Emphasises the origin while the AIS correlation phase is on screen. */
  emphasiseOrigin: boolean;
  platformNearby: boolean;
  platformLabel: string | null;
  reducedMotion: boolean;
  onSelect: (kind: MarkerKind) => void;
}

/**
 * Point evidence, as DOM markers rather than circle layers — they carry
 * labels, respond to clicks, and always sit above the geometry layers
 * regardless of the order phases mount them in.
 */
export function InvestigationMarkers({
  centroid,
  origin,
  platform,
  showCentroid,
  showOrigin,
  showPlatform,
  emphasiseOrigin,
  platformNearby,
  platformLabel,
  reducedMotion,
  onSelect,
}: MarkerLayerProps) {
  return (
    <>
      {centroid && showCentroid && (
        <Marker
          longitude={centroid.geometry.coordinates[0]}
          latitude={centroid.geometry.coordinates[1]}
          anchor="center"
        >
          <MarkerShell
            label="Slick centroid"
            reducedMotion={reducedMotion}
            onSelect={() => onSelect("centroid")}
          >
            <span className="block size-2 rotate-45 border border-[#7FD3E6] bg-[#7FD3E6]/25" />
          </MarkerShell>
        </Marker>
      )}

      {origin && showOrigin && (
        <Marker
          longitude={origin.geometry.coordinates[0]}
          latitude={origin.geometry.coordinates[1]}
          anchor="center"
        >
          <MarkerShell
            label="Probable origin"
            reducedMotion={reducedMotion}
            onSelect={() => onSelect("origin")}
          >
            <span className="relative block size-3">
              <span className="absolute inset-0 rounded-full border border-[#8FDCEF]" />
              <span className="absolute inset-[3px] rounded-full bg-[#8FDCEF]" />
              {emphasiseOrigin && !reducedMotion && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-[#8FDCEF]"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 3.6, opacity: 0 }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
            </span>
            <MarkerLabel text="ORIGIN" />
          </MarkerShell>
        </Marker>
      )}

      {platform && showPlatform && (
        <Marker
          longitude={platform.geometry.coordinates[0]}
          latitude={platform.geometry.coordinates[1]}
          anchor="center"
        >
          <MarkerShell
            label="Nearest mapped platform"
            reducedMotion={reducedMotion}
            onSelect={() => onSelect("platform")}
          >
            <span
              className={cn(
                "block size-2.5 border",
                platformNearby
                  ? "border-[#D8A34E] bg-[#D8A34E]/30"
                  : "border-[#8FA3B8] bg-[#8FA3B8]/20"
              )}
            />
            {platformLabel && <MarkerLabel text={platformLabel} muted={!platformNearby} />}
          </MarkerShell>
        </Marker>
      )}
    </>
  );
}

function MarkerShell({
  label,
  reducedMotion,
  onSelect,
  children,
}: {
  label: string;
  reducedMotion: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex cursor-pointer flex-col items-center gap-1 bg-transparent focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
    >
      {children}
    </motion.button>
  );
}

function MarkerLabel({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-sm bg-[#05070a]/80 px-1.5 py-0.5 text-[8.5px] tracking-[0.12em]",
        jetbrainsMono.className,
        muted ? "text-white/40" : "text-white/70"
      )}
    >
      {text}
    </span>
  );
}
