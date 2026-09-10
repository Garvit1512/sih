/**
 * Frontend mirror of the backend's frozen cross-stage contracts
 * (`backend/app/schemas/*.py`, see also `docs/contracts.md`).
 *
 * Where the backend and this file disagree, the backend wins — these types
 * exist to describe what the API actually returns, not what the UI wishes it
 * returned. Optional stage results are explicitly nullable so the UI can tell
 * "not computed / not applicable" apart from zero (PRD §70).
 */

/* ------------------------------------------------------------------ */
/* Geo + time primitives (backend/app/schemas/common.py)               */
/* ------------------------------------------------------------------ */

/** API coordinate objects are always {lat, lon}. */
export interface Coordinate {
  readonly lat: number;
  readonly lon: number;
}

/** GeoJSON geometries always carry [lon, lat], per the GeoJSON spec. */
export interface GeoJSONPolygon {
  readonly type: "Polygon";
  readonly coordinates: number[][][];
}

export interface GeoJSONLineString {
  readonly type: "LineString";
  readonly coordinates: number[][];
}

export interface TimeWindow {
  readonly start: string;
  readonly end: string;
}

/* ------------------------------------------------------------------ */
/* Stage A — detection (backend/app/schemas/detection.py)              */
/* ------------------------------------------------------------------ */

export interface DetectionConfidence {
  readonly value: number;
  /** Deliberately not a calibrated probability — must be labelled as such. */
  readonly type: "indicative_uncalibrated";
  readonly label: string;
}

export interface SpillGeometry {
  readonly centroid: Coordinate;
  readonly polygon: GeoJSONPolygon;
  readonly area_km2: number;
  readonly perimeter_km: number;
  readonly elongation: number;
  readonly coastline_distance_km: number | null;
}

export interface DetectionResult {
  readonly case_id: string;
  readonly detected_at: string;
  readonly spill: SpillGeometry;
  readonly detection_confidence: DetectionConfidence;
}

/* ------------------------------------------------------------------ */
/* Stage B — source-type triage (backend/app/schemas/triage.py)        */
/* ------------------------------------------------------------------ */

export type TriageHypothesis =
  | "likely-vessel"
  | "likely-platform"
  | "likely-pipeline"
  | "possible-natural-seep"
  | "insufficient-evidence";

export interface TriageConfidence {
  readonly tier: "High" | "Medium" | "Low";
  readonly value: number | null;
  readonly type: "rule_based";
}

export interface InfrastructureEvidence {
  readonly nearby: boolean;
  readonly distance_km: number | null;
  readonly id: string | null;
  readonly name: string | null;
  readonly location: Coordinate | null;
}

export interface TriageEvidence {
  readonly platform: InfrastructureEvidence;
  readonly pipeline: InfrastructureEvidence;
  readonly vessel_evidence_available: boolean;
  readonly narrative: string[];
}

export interface TriageRouting {
  readonly run_vessel_attribution: boolean;
  readonly low_confidence: boolean;
}

export interface TriageResult {
  readonly case_id: string;
  readonly hypothesis: TriageHypothesis;
  readonly confidence: TriageConfidence;
  readonly evidence: TriageEvidence;
  readonly routing: TriageRouting;
}

/* ------------------------------------------------------------------ */
/* Stage C — drift (backend/app/schemas/drift.py)                      */
/* ------------------------------------------------------------------ */

export interface HindcastResult {
  readonly origin: Coordinate;
  readonly origin_time_window: TimeWindow;
  readonly path: GeoJSONLineString;
}

export interface ForecastResult {
  readonly path: GeoJSONLineString;
  readonly time_to_coastline_hours: number | null;
  readonly time_to_sensitive_zone_hours: number | null;
}

export interface DriftResult {
  readonly case_id: string;
  readonly hindcast: HindcastResult;
  readonly forecast: ForecastResult;
  readonly uncertainty: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/* Stage D — attribution (backend/app/schemas/attribution.py)          */
/* ------------------------------------------------------------------ */

export interface VesselFeatures {
  readonly proximity: number;
  readonly trajectory_alignment: number;
}

export interface VesselCandidate {
  readonly vessel_id: string;
  readonly vessel_name: string | null;
  readonly score: number;
  readonly confidence_tier: "High" | "Medium" | "Low";
  readonly features: VesselFeatures;
  readonly evidence: string[];
}

export interface DataDisclosure {
  readonly ais_type: "synthetic" | "real";
  readonly description: string;
}

export interface AttributionResult {
  readonly case_id: string;
  /** False when Stage B routed away from vessel attribution — a valid state. */
  readonly executed: boolean;
  readonly reason: string | null;
  readonly data_disclosure: DataDisclosure | null;
  readonly candidates: VesselCandidate[];
  readonly low_confidence: boolean;
}

/* ------------------------------------------------------------------ */
/* Stage E — report (backend/app/schemas/report.py)                    */
/* ------------------------------------------------------------------ */

export interface CaseSummary {
  readonly case_id: string;
  readonly name: string;
  readonly region: string;
  readonly investigation_timestamp: string;
  readonly detection_timestamp: string;
}

export interface InvestigationReport {
  readonly case_id: string;
  readonly summary: CaseSummary;
  readonly detection: DetectionResult;
  readonly source_hypothesis: TriageResult;
  readonly drift: DriftResult;
  readonly attribution: AttributionResult;
  readonly provenance: Record<string, string>;
  readonly limitations: string[];
  readonly synthetic_ais_disclosure: string | null;
  readonly disclaimer: string;
}

/* ------------------------------------------------------------------ */
/* Aggregate (backend/app/schemas/investigation.py)                    */
/* ------------------------------------------------------------------ */

export interface CaseMeta {
  readonly case_id: string;
  readonly name: string;
  readonly region: string;
  readonly date: string;
  readonly is_historical_ground_truth: boolean;
}

export type InvestigationStatus = "pending" | "running" | "complete" | "failed";

export interface InvestigationCase {
  readonly case_id: string;
  readonly case_meta: CaseMeta;
  readonly detection: DetectionResult | null;
  readonly triage: TriageResult | null;
  readonly drift: DriftResult | null;
  readonly attribution: AttributionResult | null;
  readonly report: InvestigationReport | null;
  readonly provenance: Record<string, string>;
  readonly status: InvestigationStatus;
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/* Frontend-only UI state                                              */
/* ------------------------------------------------------------------ */

/** User-facing stages, per oil-spill-pipeline/CLAUDE.md §6. */
export type InvestigationStageId =
  | "detection"
  | "rule-out"
  | "time-travel"
  | "lineup"
  | "verdict";

/**
 * `unavailable` is distinct from `locked`: the stage ran but the backend
 * returned no data for it (e.g. attribution skipped because triage found a
 * stationary source). That is a valid system state, not an error.
 */
export type InvestigationStageStatus =
  | "locked"
  | "active"
  | "complete"
  | "unavailable";

export interface InvestigationStage {
  readonly id: InvestigationStageId;
  readonly order: number;
  readonly label: string;
  readonly subtitle: string;
  readonly status: InvestigationStageStatus;
  /** Shown when a stage is deliberately not applicable for this case. */
  readonly note: string | null;
}

export type SarUploadStatus = "idle" | "selected" | "rejected";

export interface SarUploadState {
  readonly status: SarUploadStatus;
  readonly file: File | null;
  readonly rejectionReason: string | null;
}

export type MapLayerId =
  | "satellite"
  | "oceanographic"
  | "ais"
  | "infrastructure"
  | "weather";

export interface MapLayerToggle {
  readonly id: MapLayerId;
  readonly label: string;
  readonly active: boolean;
}

export interface InvestigationCoordinates {
  readonly lat: number;
  readonly lon: number;
}
