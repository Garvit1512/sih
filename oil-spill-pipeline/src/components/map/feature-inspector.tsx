"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import {
  formatCoordinate,
  formatUtcTimeOnly,
} from "@/lib/investigation-phases";
import type { MarkerKind } from "@/components/map/layers/investigation-markers";
import type { InvestigationCase } from "@/types/investigation";

interface InspectorRow {
  readonly label: string;
  readonly value: string;
}

/**
 * Read-out for a clicked map feature (parent CLAUDE.md §34).
 *
 * Only values present in the response are listed; a field the backend did not
 * supply is reported as such rather than shown as zero (§70).
 */
export function FeatureInspector({
  kind,
  investigation,
  onClose,
  reducedMotion,
}: {
  kind: MarkerKind | null;
  investigation: InvestigationCase | null;
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const content = kind && investigation ? describe(kind, investigation) : null;

  return (
    <AnimatePresence>
      {content && (
        <motion.aside
          key={kind}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-[280px] rounded-sm border border-white/[0.09] bg-[#0b0f16]/90 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2">
            <p className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/55">
              {content.title}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close feature details"
              className="text-white/35 transition-colors hover:text-white/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
            >
              <X className="size-3" />
            </button>
          </div>

          <dl
            className={cn(
              "space-y-1.5 px-3 py-2.5 text-[10.5px]",
              jetbrainsMono.className
            )}
          >
            {content.rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-white/35">{row.label}</dt>
                <dd className="truncate text-right text-white/70">{row.value}</dd>
              </div>
            ))}
          </dl>

          {content.note && (
            <p className="border-t border-white/[0.07] px-3 py-2 text-[10px] leading-relaxed text-white/40">
              {content.note}
            </p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function describe(
  kind: MarkerKind,
  investigation: InvestigationCase
): { title: string; rows: InspectorRow[]; note: string | null } | null {
  if (kind === "centroid") {
    const detection = investigation.detection;
    if (!detection) return null;
    return {
      title: "Slick centroid",
      rows: [
        {
          label: "Position",
          value: formatCoordinate(
            detection.spill.centroid.lat,
            detection.spill.centroid.lon
          ),
        },
        { label: "Area", value: `${detection.spill.area_km2} km²` },
        { label: "Perimeter", value: `${detection.spill.perimeter_km} km` },
        { label: "Elongation", value: `${detection.spill.elongation}` },
        {
          label: "To coastline",
          value:
            detection.spill.coastline_distance_km !== null
              ? `${detection.spill.coastline_distance_km} km`
              : "Not provided",
        },
        {
          label: "Confidence",
          value: `${Math.round(detection.detection_confidence.value * 100)}%`,
        },
      ],
      note: `${detection.detection_confidence.label} — indicative, not a calibrated probability. SAR look-alikes (wind shadows, algal slicks, ship wakes) cannot be excluded from a single scene.`,
    };
  }

  if (kind === "origin") {
    const drift = investigation.drift;
    if (!drift) return null;
    const window = drift.hindcast.origin_time_window;
    return {
      title: "Probable origin",
      rows: [
        {
          label: "Position",
          value: formatCoordinate(drift.hindcast.origin.lat, drift.hindcast.origin.lon),
        },
        {
          label: "Window",
          value: `${formatUtcTimeOnly(window.start)}–${formatUtcTimeOnly(window.end)} UTC`,
        },
        {
          label: "To coastline",
          value:
            drift.forecast.time_to_coastline_hours !== null
              ? `${drift.forecast.time_to_coastline_hours} h`
              : "Not provided",
        },
        {
          label: "Sensitive zone",
          value:
            drift.forecast.time_to_sensitive_zone_hours !== null
              ? `${drift.forecast.time_to_sensitive_zone_hours} h`
              : "Not provided",
        },
        { label: "Source", value: investigation.provenance.drift ?? "Not provided" },
      ],
      note: "An estimated origin from backward drift modelling, not an observed release point.",
    };
  }

  const platform = investigation.triage?.evidence.platform;
  if (!platform?.location) return null;
  return {
    title: "Nearest mapped platform",
    rows: [
      { label: "Name", value: platform.name ?? "Not provided" },
      { label: "ID", value: platform.id ?? "Not provided" },
      {
        label: "Position",
        value: formatCoordinate(platform.location.lat, platform.location.lon),
      },
      {
        label: "To origin",
        value:
          platform.distance_km !== null
            ? `${platform.distance_km.toFixed(1)} km`
            : "Not provided",
      },
      { label: "Within radius", value: platform.nearby ? "Yes" : "No" },
    ],
    note: `Infrastructure source: ${investigation.provenance.infrastructure ?? "not provided"}. Public infrastructure coverage may be incomplete.`,
  };
}
