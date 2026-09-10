"use client";

import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import type { InvestigationCase } from "@/types/investigation";

/** Backend hypothesis enum -> investigator-facing wording. */
const HYPOTHESIS_LABEL: Record<string, string> = {
  "likely-vessel": "Likely vessel",
  "likely-platform": "Likely platform",
  "likely-pipeline": "Likely pipeline",
  "possible-natural-seep": "Possible natural seep",
  "insufficient-evidence": "Insufficient evidence",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
      <dt className="shrink-0 text-white/38">{label}</dt>
      <dd className="truncate text-right text-white/70">{value}</dd>
    </div>
  );
}

/**
 * Everything here is read straight off the backend's InvestigationCase.
 * Nothing is synthesised: when the backend omits a stage, this says so
 * rather than inventing a plausible-looking value (PRD §69/§70).
 */
export function InvestigationResults({
  investigation,
}: {
  investigation: InvestigationCase;
}) {
  const { detection, triage, drift, attribution } = investigation;

  return (
    <div className="space-y-5">
      {/* ---------------- Detection ---------------- */}
      <section className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          Detection
        </p>

        {detection ? (
          <>
            <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/38">
                  Detection confidence
                </span>
                <span
                  className={cn(
                    "text-[17px] leading-none text-white/85",
                    jetbrainsMono.className
                  )}
                >
                  {Math.round(detection.detection_confidence.value * 100)}
                  <span className="text-[10px] text-white/45">%</span>
                </span>
              </div>
              {/* The backend types this as uncalibrated; never present it as a
                  calibrated probability (CLAUDE.md §23). */}
              <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-[#D8A34E]/80">
                Indicative / uncalibrated
              </p>
            </div>

            <dl
              className={cn(
                "space-y-1.5 text-[11px] text-white/62",
                jetbrainsMono.className
              )}
            >
              <Row
                label="Centroid"
                value={`${detection.spill.centroid.lat.toFixed(4)}°, ${detection.spill.centroid.lon.toFixed(4)}°`}
              />
              <Row label="Area" value={`${detection.spill.area_km2} km²`} />
              <Row label="Perimeter" value={`${detection.spill.perimeter_km} km`} />
              <Row label="Elongation" value={`${detection.spill.elongation}`} />
              {detection.spill.coastline_distance_km !== null && (
                <Row
                  label="To coastline"
                  value={`${detection.spill.coastline_distance_km} km`}
                />
              )}
            </dl>
          </>
        ) : (
          <UnavailableNote text="No detection result returned for this case." />
        )}
      </section>

      {/* ---------------- Triage ---------------- */}
      <section className="space-y-2 border-t border-white/[0.06] pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          Source-type triage
        </p>

        {triage ? (
          <>
            <div className="rounded-md border border-[#4FB8D9]/25 bg-[#4FB8D9]/[0.05] px-3 py-2.5">
              <p className="text-[12px] text-white/85">
                {HYPOTHESIS_LABEL[triage.hypothesis] ?? triage.hypothesis}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/40">
                {triage.confidence.tier} confidence · rule-based
              </p>
            </div>

            <dl
              className={cn(
                "space-y-1.5 text-[11px] text-white/62",
                jetbrainsMono.className
              )}
            >
              <Row
                label="Nearest platform"
                value={
                  triage.evidence.platform.distance_km !== null
                    ? `${triage.evidence.platform.distance_km.toFixed(1)} km`
                    : "Not available"
                }
              />
              <Row
                label="Nearest pipeline"
                value={
                  triage.evidence.pipeline.distance_km !== null
                    ? `${triage.evidence.pipeline.distance_km.toFixed(1)} km`
                    : "Not available"
                }
              />
            </dl>

            {triage.evidence.narrative.length > 0 && (
              <ul className="space-y-1 pt-1">
                {triage.evidence.narrative.map((line) => (
                  <li
                    key={line}
                    className="border-l border-white/12 pl-2.5 text-[11px] leading-snug text-white/50"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <UnavailableNote text="No triage result returned for this case." />
        )}
      </section>

      {/* ---------------- Drift ---------------- */}
      <section className="space-y-2 border-t border-white/[0.06] pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          Backward drift
        </p>
        {drift ? (
          <dl
            className={cn(
              "space-y-1.5 text-[11px] text-white/62",
              jetbrainsMono.className
            )}
          >
            <Row
              label="Probable origin"
              value={`${drift.hindcast.origin.lat.toFixed(4)}°, ${drift.hindcast.origin.lon.toFixed(4)}°`}
            />
            <Row
              label="Window start"
              value={drift.hindcast.origin_time_window.start.replace("T", " ").replace("Z", " UTC")}
            />
            {drift.forecast.time_to_coastline_hours !== null && (
              <Row
                label="To coastline"
                value={`${drift.forecast.time_to_coastline_hours} h`}
              />
            )}
          </dl>
        ) : (
          <UnavailableNote text="No drift reconstruction returned for this case." />
        )}
      </section>

      {/* ---------------- Attribution ---------------- */}
      <section className="space-y-2 border-t border-white/[0.06] pt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          AIS lineup
        </p>

        {!attribution && (
          <UnavailableNote text="No attribution result returned for this case." />
        )}

        {attribution && !attribution.executed && (
          // A deliberate skip is a valid system state, not a failure (§38).
          <UnavailableNote
            text={
              attribution.reason ??
              "Vessel attribution was not run for this case."
            }
          />
        )}

        {attribution?.executed && (
          <>
            {attribution.data_disclosure && (
              <p className="text-[10px] leading-relaxed text-[#D8A34E]/75">
                {attribution.data_disclosure.description}
              </p>
            )}
            {attribution.candidates.length === 0 ? (
              <UnavailableNote text="No candidate vessels were returned." />
            ) : (
              <ul className="space-y-2">
                {attribution.candidates.map((candidate) => (
                  <li
                    key={candidate.vessel_id}
                    className="border-l border-[#4FB8D9]/30 pl-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "text-[11px] text-white/75",
                          jetbrainsMono.className
                        )}
                      >
                        {candidate.vessel_name ?? candidate.vessel_id}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] text-white/60",
                          jetbrainsMono.className
                        )}
                      >
                        {candidate.score.toFixed(0)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/40">
                      {candidate.confidence_tier} · investigative lead
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Required positioning — must not be reworded (CLAUDE.md §20). */}
      <p className="border-t border-white/[0.06] pt-4 text-[10.5px] leading-relaxed text-white/40">
        This is a decision-support lead list, not a legal determination.
      </p>
    </div>
  );
}

function UnavailableNote({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-white/45">
      {text}
    </p>
  );
}
