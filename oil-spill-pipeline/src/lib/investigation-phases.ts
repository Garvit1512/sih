/**
 * The narrative layer of the guided investigation.
 *
 * Every headline and supporting line below is composed from values the
 * backend actually returned. Nothing here infers, scores, or concludes — if a
 * stage produced no data, the phase says so in the backend's own words rather
 * than filling the gap (parent CLAUDE.md §69/§70/§71). Attribution wording
 * stays at "investigative lead" (§22) and detection confidence stays labelled
 * indicative (§23).
 */

import type {
  InvestigationCase,
  InvestigationStageId,
  TriageHypothesis,
} from "@/types/investigation";

export type PhaseId = InvestigationStageId;

/** Ordered phase sequence — mirrors the user-facing stages in CLAUDE.md §6. */
export const PHASE_ORDER: readonly PhaseId[] = [
  "detection",
  "rule-out",
  "time-travel",
  "lineup",
  "verdict",
];

/**
 * How long each phase holds before the sequence advances on its own. Tuned so
 * an investigator can read the evidence without the camera moving under them;
 * the final phase never auto-advances.
 */
export const PHASE_DWELL_MS: Record<PhaseId, number> = {
  detection: 5200,
  "rule-out": 6400,
  "time-travel": 7000,
  lineup: 6400,
  verdict: 0,
};

export type PhaseTone = "analytical" | "caution" | "not-applicable";

export interface PhaseNarrative {
  readonly id: PhaseId;
  readonly order: number;
  /** Short all-caps banner, e.g. POTENTIAL SLICK DETECTED. */
  readonly headline: string;
  /** One line of context under the headline. */
  readonly detail: string | null;
  /** Backend-supplied evidence lines, verbatim. */
  readonly evidence: readonly string[];
  readonly tone: PhaseTone;
}

const HYPOTHESIS_HEADLINE: Record<TriageHypothesis, string> = {
  "likely-vessel": "NO STATIONARY SOURCE NEARBY",
  "likely-platform": "STATIONARY SOURCE — PLATFORM",
  "likely-pipeline": "STATIONARY SOURCE — PIPELINE",
  "possible-natural-seep": "POSSIBLE NATURAL SEEP",
  "insufficient-evidence": "INSUFFICIENT EVIDENCE",
};

export const HYPOTHESIS_LABEL: Record<TriageHypothesis, string> = {
  "likely-vessel": "Likely vessel",
  "likely-platform": "Likely platform",
  "likely-pipeline": "Likely pipeline",
  "possible-natural-seep": "Possible natural seep",
  "insufficient-evidence": "Insufficient evidence",
};

/** ISO-8601 UTC -> "29 Aug 2026 06:00 UTC". Backend time stays UTC (§10). */
export function formatUtc(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const date = parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${date} ${time} UTC`;
}

/** Compact "06:00–10:00 UTC" form for a same-day origin window. */
export function formatUtcTimeOnly(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function formatCoordinate(lat: number, lon: number): string {
  const latHemisphere = lat >= 0 ? "N" : "S";
  const lonHemisphere = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latHemisphere}  ${Math.abs(lon).toFixed(4)}° ${lonHemisphere}`;
}

function detectionNarrative(investigation: InvestigationCase): PhaseNarrative {
  const detection = investigation.detection;
  if (!detection) {
    return {
      id: "detection",
      order: 1,
      headline: "NO DETECTION RETURNED",
      detail: "Stage A produced no detection result for this case.",
      evidence: [],
      tone: "not-applicable",
    };
  }

  const confidence = Math.round(detection.detection_confidence.value * 100);
  const evidence = [
    `Slick footprint ${detection.spill.area_km2} km², perimeter ${detection.spill.perimeter_km} km, elongation ${detection.spill.elongation}.`,
    `${detection.detection_confidence.label}: ${confidence}% — indicative, not a calibrated probability.`,
  ];
  if (detection.spill.coastline_distance_km !== null) {
    evidence.push(
      `Detected ${detection.spill.coastline_distance_km} km from the nearest coastline.`
    );
  }

  return {
    id: "detection",
    order: 1,
    headline: "POTENTIAL SLICK DETECTED",
    detail: `${formatUtc(detection.detected_at)} · ${detection.spill.area_km2} km²`,
    evidence,
    tone: "analytical",
  };
}

function ruleOutNarrative(investigation: InvestigationCase): PhaseNarrative {
  const triage = investigation.triage;
  if (!triage) {
    return {
      id: "rule-out",
      order: 2,
      headline: "NO TRIAGE RESULT",
      detail: "Stage B produced no source-type triage for this case.",
      evidence: [],
      tone: "not-applicable",
    };
  }

  return {
    id: "rule-out",
    order: 2,
    headline: HYPOTHESIS_HEADLINE[triage.hypothesis] ?? triage.hypothesis,
    detail: `${HYPOTHESIS_LABEL[triage.hypothesis] ?? triage.hypothesis} · ${triage.confidence.tier} confidence · rule-based`,
    // The triage engine's own explanation, unedited.
    evidence: triage.evidence.narrative,
    tone: triage.hypothesis === "insufficient-evidence" ? "caution" : "analytical",
  };
}

function timeTravelNarrative(investigation: InvestigationCase): PhaseNarrative {
  const drift = investigation.drift;
  if (!drift) {
    return {
      id: "time-travel",
      order: 3,
      headline: "NO DRIFT RECONSTRUCTION",
      detail: "Stage C produced no hindcast for this case.",
      evidence: [],
      tone: "not-applicable",
    };
  }

  const { origin, origin_time_window: window } = drift.hindcast;
  const evidence = [
    `Backward drift places the probable origin at ${formatCoordinate(origin.lat, origin.lon)}.`,
    `Origin time window ${formatUtcTimeOnly(window.start)}–${formatUtcTimeOnly(window.end)} UTC on ${formatUtc(window.start).split(" ").slice(0, 3).join(" ")}.`,
  ];
  if (drift.forecast.time_to_coastline_hours !== null) {
    evidence.push(
      `Forward forecast reaches the coastline in approximately ${drift.forecast.time_to_coastline_hours} h.`
    );
  }
  if (drift.forecast.time_to_sensitive_zone_hours !== null) {
    evidence.push(
      `Forward forecast reaches a sensitive zone in approximately ${drift.forecast.time_to_sensitive_zone_hours} h.`
    );
  }

  return {
    id: "time-travel",
    order: 3,
    headline: "POTENTIAL SOURCE WINDOW",
    detail: `${formatUtcTimeOnly(window.start)}–${formatUtcTimeOnly(window.end)} UTC · ${formatCoordinate(origin.lat, origin.lon)}`,
    evidence,
    tone: "analytical",
  };
}

function lineupNarrative(investigation: InvestigationCase): PhaseNarrative {
  const attribution = investigation.attribution;

  if (!attribution) {
    return {
      id: "lineup",
      order: 4,
      headline: "AIS ATTRIBUTION\nNOT APPLICABLE",
      detail: "No attribution result was returned for this case.",
      evidence: [],
      tone: "not-applicable",
    };
  }

  // A deliberate skip is a valid system state, not an error (§38) — and the
  // reason is the backend's, not ours.
  if (!attribution.executed) {
    return {
      id: "lineup",
      order: 4,
      headline: "AIS ATTRIBUTION\nNOT APPLICABLE",
      detail: attribution.reason ?? "Vessel attribution was not run for this case.",
      evidence: attribution.reason ? [attribution.reason] : [],
      tone: "not-applicable",
    };
  }

  const evidence: string[] = [];
  if (attribution.low_confidence) {
    evidence.push(
      "Routed as a clearly labelled low-confidence investigation — treat every candidate accordingly."
    );
  }
  evidence.push(
    attribution.candidates.length === 0
      ? "No candidate vessels were returned."
      : `${attribution.candidates.length} candidate vessel${attribution.candidates.length === 1 ? "" : "s"} correlated against the origin time window.`
  );
  if (attribution.data_disclosure) {
    evidence.push(attribution.data_disclosure.description);
  }

  return {
    id: "lineup",
    order: 4,
    headline: "AIS CORRELATION",
    detail: attribution.low_confidence
      ? "Low-confidence lead list"
      : "Candidates ranked under the current attribution criteria",
    evidence,
    tone: attribution.low_confidence ? "caution" : "analytical",
  };
}

function verdictNarrative(investigation: InvestigationCase): PhaseNarrative {
  const report = investigation.report;
  if (!report) {
    return {
      id: "verdict",
      order: 5,
      headline: "NO DOSSIER RETURNED",
      detail: "Stage E produced no report for this case.",
      evidence: [],
      tone: "not-applicable",
    };
  }

  const triage = investigation.triage;
  const attribution = investigation.attribution;
  const evidence: string[] = [];

  if (investigation.detection) {
    evidence.push(
      `Detection: ${investigation.detection.spill.area_km2} km² slick, ${investigation.detection.detection_confidence.label.toLowerCase()} ${Math.round(investigation.detection.detection_confidence.value * 100)}%.`
    );
  }
  if (triage) {
    evidence.push(
      `Source hypothesis: ${HYPOTHESIS_LABEL[triage.hypothesis] ?? triage.hypothesis} (${triage.confidence.tier} confidence).`
    );
  }
  if (investigation.drift) {
    const window = investigation.drift.hindcast.origin_time_window;
    evidence.push(
      `Potential source window: ${formatUtcTimeOnly(window.start)}–${formatUtcTimeOnly(window.end)} UTC.`
    );
  }
  if (attribution?.executed) {
    evidence.push(
      attribution.candidates.length > 0
        ? `AIS correlation: ${attribution.candidates.length} investigative lead${attribution.candidates.length === 1 ? "" : "s"}, highest score ${Math.max(...attribution.candidates.map((candidate) => candidate.score)).toFixed(0)}.`
        : "AIS correlation returned no candidate vessels."
    );
  } else if (attribution) {
    evidence.push(
      `AIS correlation not applicable: ${attribution.reason ?? "vessel attribution was not run."}`
    );
  }

  return {
    id: "verdict",
    order: 5,
    headline: "EVIDENCE SYNTHESIS",
    detail: report.summary.name,
    evidence,
    tone: "analytical",
  };
}

const BUILDERS: Record<PhaseId, (investigation: InvestigationCase) => PhaseNarrative> = {
  detection: detectionNarrative,
  "rule-out": ruleOutNarrative,
  "time-travel": timeTravelNarrative,
  lineup: lineupNarrative,
  verdict: verdictNarrative,
};

export function buildPhaseNarratives(
  investigation: InvestigationCase | null
): Record<PhaseId, PhaseNarrative> | null {
  if (!investigation) return null;
  return {
    detection: BUILDERS.detection(investigation),
    "rule-out": BUILDERS["rule-out"](investigation),
    "time-travel": BUILDERS["time-travel"](investigation),
    lineup: BUILDERS.lineup(investigation),
    verdict: BUILDERS.verdict(investigation),
  };
}
