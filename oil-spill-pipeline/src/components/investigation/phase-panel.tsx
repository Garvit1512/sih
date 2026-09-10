"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import {
  HYPOTHESIS_LABEL,
  formatCoordinate,
  formatUtc,
  formatUtcTimeOnly,
  type PhaseId,
} from "@/lib/investigation-phases";
import type {
  AttributionResult,
  DetectionResult,
  DriftResult,
  InvestigationCase,
  InvestigationReport,
  TriageResult,
  VesselCandidate,
} from "@/types/investigation";

/**
 * The sidebar contents for the phase currently on screen.
 *
 * The whole `InvestigationCase` is already in hand, but showing all of it at
 * once is what turned this panel into a JSON dump. Each phase renders only
 * the evidence it is about; the dossier at the end brings it back together.
 * Nothing is computed here that the backend did not return (PRD §69/§70).
 */
export function PhasePanel({
  phase,
  investigation,
  reducedMotion,
}: {
  phase: PhaseId;
  investigation: InvestigationCase;
  reducedMotion: boolean;
}) {
  switch (phase) {
    case "detection":
      return <DetectionPanel detection={investigation.detection} />;
    case "rule-out":
      return <RuleOutPanel triage={investigation.triage} />;
    case "time-travel":
      return <DriftPanel drift={investigation.drift} />;
    case "lineup":
      return (
        <LineupPanel
          attribution={investigation.attribution}
          reducedMotion={reducedMotion}
        />
      );
    case "verdict":
      return <VerdictPanel investigation={investigation} />;
  }
}

/* ------------------------------------------------------------------ */
/* Phase 01 — DETECTION                                                */
/* ------------------------------------------------------------------ */

function DetectionPanel({ detection }: { detection: DetectionResult | null }) {
  if (!detection) {
    return <Unavailable text="No detection result returned for this case." />;
  }

  return (
    <PanelSection title="Detection" subtitle="SAR image analysis">
      <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-white/38">
            Detection confidence
          </span>
          <span className={cn("text-[19px] leading-none text-white/90", jetbrainsMono.className)}>
            {Math.round(detection.detection_confidence.value * 100)}
            <span className="text-[10px] text-white/45">%</span>
          </span>
        </div>
        {/* The backend types this as uncalibrated; never present it as a
            calibrated probability (CLAUDE.md §23). */}
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-[#D8A34E]/80">
          {detection.detection_confidence.label} · uncalibrated
        </p>
      </div>

      <DataList>
        <Row
          label="Centroid"
          value={formatCoordinate(
            detection.spill.centroid.lat,
            detection.spill.centroid.lon
          )}
        />
        <Row label="Detected" value={formatUtc(detection.detected_at)} />
        <Row label="Area" value={`${detection.spill.area_km2} km²`} />
        <Row label="Perimeter" value={`${detection.spill.perimeter_km} km`} />
        <Row label="Elongation" value={`${detection.spill.elongation}`} />
        <Row
          label="To coastline"
          value={
            detection.spill.coastline_distance_km !== null
              ? `${detection.spill.coastline_distance_km} km`
              : "Not provided"
          }
        />
      </DataList>

      <Footnote>
        A dark-surface signature consistent with an oil slick. SAR look-alikes —
        wind shadows, algal slicks, ship wakes — cannot be excluded from a
        single scene.
      </Footnote>
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 02 — RULE-OUT                                                 */
/* ------------------------------------------------------------------ */

function RuleOutPanel({ triage }: { triage: TriageResult | null }) {
  if (!triage) {
    return <Unavailable text="No triage result returned for this case." />;
  }

  const { platform, pipeline } = triage.evidence;
  const stationary =
    triage.hypothesis === "likely-platform" || triage.hypothesis === "likely-pipeline";

  return (
    <PanelSection title="Rule-out" subtitle="Infrastructure & source-type triage">
      <div
        className={cn(
          "rounded-md border px-3 py-2.5",
          stationary
            ? "border-[#D8A34E]/30 bg-[#D8A34E]/[0.06]"
            : "border-[#4FB8D9]/25 bg-[#4FB8D9]/[0.05]"
        )}
      >
        <p className="text-[12.5px] text-white/90">
          {HYPOTHESIS_LABEL[triage.hypothesis] ?? triage.hypothesis}
        </p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-white/40">
          {triage.confidence.tier} confidence · rule-based
        </p>
      </div>

      <DataList>
        <Row
          label={platform.name ?? "Nearest platform"}
          value={
            platform.distance_km !== null
              ? `${platform.distance_km.toFixed(1)} km`
              : "Not provided"
          }
          emphasis={platform.nearby}
        />
        <Row
          label={pipeline.name ?? "Nearest pipeline"}
          value={
            pipeline.distance_km !== null
              ? `${pipeline.distance_km.toFixed(1)} km`
              : "Not provided"
          }
          emphasis={pipeline.nearby}
        />
        <Row
          label="Vessel evidence"
          value={triage.evidence.vessel_evidence_available ? "Available" : "None"}
        />
      </DataList>

      {triage.evidence.narrative.length > 0 && (
        <ul className="space-y-1.5">
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

      <RoutingNote triage={triage} />
    </PanelSection>
  );
}

function RoutingNote({ triage }: { triage: TriageResult }) {
  const runs = triage.routing.run_vessel_attribution;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-[10.5px] leading-relaxed",
        runs
          ? "border-white/[0.08] bg-white/[0.02] text-white/50"
          : "border-white/[0.08] bg-white/[0.02] text-white/50"
      )}
    >
      <span className="mr-1.5 text-[9.5px] uppercase tracking-[0.12em] text-white/35">
        Routing
      </span>
      {runs
        ? triage.routing.low_confidence
          ? "Vessel attribution will run as a clearly labelled low-confidence investigation."
          : "Vessel attribution will run for this case."
        : "Vessel attribution is not run: the triage identified a likely stationary source."}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 03 — TIME TRAVEL                                              */
/* ------------------------------------------------------------------ */

function DriftPanel({ drift }: { drift: DriftResult | null }) {
  if (!drift) {
    return <Unavailable text="No drift reconstruction returned for this case." />;
  }

  const window = drift.hindcast.origin_time_window;

  return (
    <PanelSection title="Time travel" subtitle="Backward drift modelling">
      <div className="rounded-md border border-[#4FB8D9]/25 bg-[#4FB8D9]/[0.05] px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/38">
          Potential source window
        </p>
        <p className={cn("mt-1 text-[13px] text-white/90", jetbrainsMono.className)}>
          {formatUtcTimeOnly(window.start)}–{formatUtcTimeOnly(window.end)} UTC
        </p>
        <p className="mt-0.5 text-[10px] text-white/45">
          {formatUtc(window.start).split(" ").slice(0, 3).join(" ")}
        </p>
      </div>

      <DataList>
        <Row
          label="Probable origin"
          value={formatCoordinate(drift.hindcast.origin.lat, drift.hindcast.origin.lon)}
        />
        <Row
          label="Hindcast vertices"
          value={`${drift.hindcast.path.coordinates.length}`}
        />
        <Row
          label="To coastline"
          value={
            drift.forecast.time_to_coastline_hours !== null
              ? `${drift.forecast.time_to_coastline_hours} h`
              : "Not provided"
          }
        />
        <Row
          label="To sensitive zone"
          value={
            drift.forecast.time_to_sensitive_zone_hours !== null
              ? `${drift.forecast.time_to_sensitive_zone_hours} h`
              : "Not provided"
          }
        />
        <Row
          label="Uncertainty"
          value={drift.uncertainty ? "Provided" : "Not provided"}
        />
      </DataList>

      <Footnote>
        An estimated origin from backward drift modelling, not an observed
        release point.
      </Footnote>
    </PanelSection>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 04 — LINEUP                                                   */
/* ------------------------------------------------------------------ */

function LineupPanel({
  attribution,
  reducedMotion,
}: {
  attribution: AttributionResult | null;
  reducedMotion: boolean;
}) {
  if (!attribution) {
    return <Unavailable text="No attribution result returned for this case." />;
  }

  // A deliberate skip is a valid system state, not a failure (§38).
  if (!attribution.executed) {
    return (
      <PanelSection title="Lineup" subtitle="AIS vessel attribution">
        <div className="rounded-md border border-white/[0.09] bg-white/[0.02] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">
            Not applicable
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            {attribution.reason ?? "Vessel attribution was not run for this case."}
          </p>
        </div>
        <Footnote>
          No vessel is named for this case. Attributing a spill from a
          stationary source to passing traffic would be a false lead.
        </Footnote>
      </PanelSection>
    );
  }

  return (
    <PanelSection title="Lineup" subtitle="AIS vessel attribution">
      {attribution.low_confidence && (
        <div className="rounded-md border border-[#D8A34E]/30 bg-[#D8A34E]/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-[#EBC282]">
          Low-confidence investigation — the triage found no strong source
          evidence, so these leads carry correspondingly low weight.
        </div>
      )}

      {attribution.candidates.length === 0 ? (
        <Unavailable text="No candidate vessels were returned." />
      ) : (
        <ol className="space-y-2.5">
          {attribution.candidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.vessel_id}
              candidate={candidate}
              rank={index + 1}
              reducedMotion={reducedMotion}
            />
          ))}
        </ol>
      )}

      {/* Required disclosure — must not be removed (CLAUDE.md §21). */}
      {attribution.data_disclosure && (
        <p className="text-[10px] leading-relaxed text-[#D8A34E]/75">
          {attribution.data_disclosure.description}
        </p>
      )}

      <Footnote>
        Candidate vessel positions are not part of the attribution contract, so
        the lineup is ranked rather than plotted on the map.
      </Footnote>
    </PanelSection>
  );
}

function CandidateCard({
  candidate,
  rank,
  reducedMotion,
}: {
  candidate: VesselCandidate;
  rank: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: reducedMotion ? 0 : (rank - 1) * 0.32,
        ease: "easeOut",
      }}
      className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn("text-[10px] text-white/30", jetbrainsMono.className)}>
            {String(rank).padStart(2, "0")}
          </span>
          <span className="truncate text-[12px] text-white/85">
            {candidate.vessel_name ?? candidate.vessel_id}
          </span>
        </div>
        <span className={cn("shrink-0 text-[14px] text-white/85", jetbrainsMono.className)}>
          {candidate.score.toFixed(0)}
        </span>
      </div>

      <p className={cn("mt-0.5 text-[9.5px] text-white/35", jetbrainsMono.className)}>
        {candidate.vessel_id} · {candidate.confidence_tier.toUpperCase()}
      </p>

      {/* Non-accusatory framing is mandatory (CLAUDE.md §22). */}
      <p className="mt-1.5 text-[10.5px] text-white/50">
        {rank === 1
          ? "Highest-priority investigative lead under the current attribution criteria."
          : "Investigative lead under the current attribution criteria."}
      </p>

      <div className="mt-2.5 space-y-1.5">
        <Meter label="Proximity" value={candidate.features.proximity} />
        <Meter label="Trajectory" value={candidate.features.trajectory_alignment} />
      </div>

      {candidate.evidence.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {candidate.evidence.map((line) => (
            <li
              key={line}
              className="border-l border-white/12 pl-2.5 text-[10.5px] leading-snug text-white/45"
            >
              {line}
            </li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-[9.5px] uppercase tracking-[0.1em] text-white/35">
        {label}
      </span>
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="block h-full rounded-full bg-[#4FB8D9]/70"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
      <span className={cn("w-6 shrink-0 text-right text-[10px] text-white/55", jetbrainsMono.className)}>
        {value.toFixed(0)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Phase 05 — VERDICT (Investigator's Dossier)                         */
/* ------------------------------------------------------------------ */

function VerdictPanel({ investigation }: { investigation: InvestigationCase }) {
  const report = investigation.report;
  if (!report) {
    return <Unavailable text="No investigator's dossier returned for this case." />;
  }

  return (
    <PanelSection title="Verdict" subtitle="Investigator's dossier">
      <SynthesisGrid report={report} investigation={investigation} />

      <Subsection title="Case">
        <DataList>
          <Row label="Case" value={report.summary.case_id} />
          <Row label="Region" value={report.summary.region} />
          <Row label="Detected" value={formatUtc(report.summary.detection_timestamp)} />
          <Row
            label="Investigated"
            value={formatUtc(report.summary.investigation_timestamp)}
          />
        </DataList>
      </Subsection>

      <Subsection title="Forward forecast">
        <DataList>
          <Row
            label="To coastline"
            value={
              report.drift.forecast.time_to_coastline_hours !== null
                ? `${report.drift.forecast.time_to_coastline_hours} h`
                : "Not provided"
            }
          />
          <Row
            label="To sensitive zone"
            value={
              report.drift.forecast.time_to_sensitive_zone_hours !== null
                ? `${report.drift.forecast.time_to_sensitive_zone_hours} h`
                : "Not provided"
            }
          />
        </DataList>
      </Subsection>

      {report.limitations.length > 0 && (
        <Subsection title="Limitations">
          <ul className="space-y-1.5">
            {report.limitations.map((line) => (
              <li
                key={line}
                className="border-l border-[#D8A34E]/25 pl-2.5 text-[10.5px] leading-snug text-white/45"
              >
                {line}
              </li>
            ))}
          </ul>
        </Subsection>
      )}

      <Subsection title="Provenance">
        <DataList>
          {Object.entries(report.provenance).map(([stage, source]) => (
            <Row key={stage} label={stage.replace(/_/g, " ")} value={source} />
          ))}
        </DataList>
      </Subsection>

      {/* Required disclosure — must not be removed (CLAUDE.md §21). */}
      {report.synthetic_ais_disclosure && (
        <p className="text-[10px] leading-relaxed text-[#D8A34E]/75">
          {report.synthetic_ais_disclosure}
        </p>
      )}

      {/* Required positioning, rendered verbatim (CLAUDE.md §20). */}
      <p className="border-t border-white/[0.06] pt-3 text-[10.5px] leading-relaxed text-white/45">
        {report.disclaimer}
      </p>
    </PanelSection>
  );
}

/** The four evidence strands, side by side — the synthesis, not a conclusion. */
function SynthesisGrid({
  report,
  investigation,
}: {
  report: InvestigationReport;
  investigation: InvestigationCase;
}) {
  const attribution = investigation.attribution;
  const window = report.drift.hindcast.origin_time_window;

  const leadCount = attribution?.executed ? attribution.candidates.length : 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <SynthesisTile
        label="Detection confidence"
        value={`${Math.round(report.detection.detection_confidence.value * 100)}%`}
        note="Indicative"
      />
      <SynthesisTile
        label="Source hypothesis"
        value={
          HYPOTHESIS_LABEL[report.source_hypothesis.hypothesis] ??
          report.source_hypothesis.hypothesis
        }
        note={`${report.source_hypothesis.confidence.tier} confidence`}
      />
      <SynthesisTile
        label="Potential source window"
        value={`${formatUtcTimeOnly(window.start)}–${formatUtcTimeOnly(window.end)}`}
        note="UTC"
      />
      <SynthesisTile
        label="AIS correlation"
        value={
          attribution?.executed
            ? `${leadCount} lead${leadCount === 1 ? "" : "s"}`
            : "Not applicable"
        }
        note={
          attribution?.executed
            ? attribution.low_confidence
              ? "Low confidence"
              : "Ranked"
            : "Stationary source"
        }
      />
    </div>
  );
}

function SynthesisTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <p className="text-[9px] uppercase leading-tight tracking-[0.1em] text-white/32">
        {label}
      </p>
      <p className="mt-1.5 text-[12px] leading-tight text-white/85">{value}</p>
      <p className="mt-0.5 text-[9.5px] text-white/35">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function PanelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">
          {title}
        </p>
        <p className="mt-0.5 text-[10.5px] text-white/32">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
      <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-white/35">
        {title}
      </p>
      {children}
    </div>
  );
}

function DataList({ children }: { children: React.ReactNode }) {
  return (
    <dl className={cn("space-y-1.5 text-[11px] text-white/62", jetbrainsMono.className)}>
      {children}
    </dl>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-1.5">
      <dt className="shrink-0 truncate text-white/38">{label}</dt>
      <dd
        className={cn(
          "truncate text-right",
          emphasis ? "text-[#EBC282]" : "text-white/70"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] leading-relaxed text-white/35">{children}</p>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-white/45">
      {text}
    </p>
  );
}
