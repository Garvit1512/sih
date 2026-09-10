/**
 * Frontend-only state shapes for the /investigate workspace (Phase 2).
 *
 * These are UI/interaction state, not backend contracts. Once the backend
 * orchestrator and Pydantic contracts exist, this file should be reconciled
 * with them per oil-spill-pipeline/CLAUDE.md §6 (§37 of the parent
 * CLAUDE.md: TypeScript types must mirror backend contracts).
 */

/** User-facing investigation stages, per oil-spill-pipeline/CLAUDE.md §6. */
export type InvestigationStageId =
  | "detection"
  | "rule-out"
  | "time-travel"
  | "lineup"
  | "verdict";

export type InvestigationStageStatus = "active" | "locked" | "complete";

export interface InvestigationStage {
  readonly id: InvestigationStageId;
  readonly order: number;
  readonly label: string;
  readonly subtitle: string;
  readonly status: InvestigationStageStatus;
}

export type SarUploadStatus = "idle" | "selected" | "rejected";

export interface SarUploadState {
  readonly status: SarUploadStatus;
  readonly file: File | null;
  readonly rejectionReason: string | null;
}

/** Map overlay toggles. No real data sources are wired up yet (Phase 2). */
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
