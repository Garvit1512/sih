"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  InvestigationStage,
  InvestigationStageId,
  MapLayerId,
  MapLayerToggle,
  SarUploadState,
} from "@/types/investigation";

export const MAX_SAR_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** react-dropzone `accept` map: MIME type -> accepted extensions. */
export const SAR_ACCEPTED_TYPES: Record<string, string[]> = {
  "image/tiff": [".tif", ".tiff"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const STAGE_DEFINITIONS: ReadonlyArray<
  Omit<InvestigationStage, "status">
> = [
  {
    id: "detection",
    order: 1,
    label: "DETECTION",
    subtitle: "SAR Image Analysis",
  },
  {
    id: "rule-out",
    order: 2,
    label: "RULE-OUT",
    subtitle: "Infrastructure & Source-Type Triage",
  },
  {
    id: "time-travel",
    order: 3,
    label: "TIME TRAVEL",
    subtitle: "Backward Drift Modelling",
  },
  {
    id: "lineup",
    order: 4,
    label: "LINEUP",
    subtitle: "AIS Vessel Attribution",
  },
  {
    id: "verdict",
    order: 5,
    label: "VERDICT",
    subtitle: "Investigator's Dossier",
  },
];

const DEFAULT_LAYERS: MapLayerToggle[] = [
  { id: "satellite", label: "SATELLITE", active: true },
  { id: "oceanographic", label: "OCEANOGRAPHIC", active: false },
  { id: "ais", label: "AIS", active: false },
  { id: "infrastructure", label: "INFRASTRUCTURE", active: false },
  { id: "weather", label: "WEATHER", active: false },
];

const IDLE_UPLOAD: SarUploadState = {
  status: "idle",
  file: null,
  rejectionReason: null,
};

/**
 * Investigation workspace state (Phase 2: UI foundation only).
 *
 * Models exactly what the current UI needs — case name, SAR upload,
 * whether the investigation has started, the active stage, and map layer
 * toggles. Real Stage A-E data will extend this later; kept deliberately
 * minimal for now per oil-spill-pipeline/CLAUDE.md §5.
 */
export function useInvestigation() {
  const [caseName, setCaseName] = useState("");
  const [sarUpload, setSarUpload] = useState<SarUploadState>(IDLE_UPLOAD);
  const [investigationStarted, setInvestigationStarted] = useState(false);
  const [currentStageId] = useState<InvestigationStageId>("detection");
  const [layers, setLayers] = useState<MapLayerToggle[]>(DEFAULT_LAYERS);

  const stages: InvestigationStage[] = useMemo(
    () =>
      STAGE_DEFINITIONS.map((stage) => ({
        ...stage,
        status: stage.id === currentStageId ? "active" : "locked",
      })),
    [currentStageId]
  );

  const selectSarFile = useCallback((file: File) => {
    setSarUpload({ status: "selected", file, rejectionReason: null });
  }, []);

  const rejectSarFile = useCallback((reason: string) => {
    setSarUpload({ status: "rejected", file: null, rejectionReason: reason });
  }, []);

  const clearSarFile = useCallback(() => {
    setSarUpload(IDLE_UPLOAD);
  }, []);

  const canStartInvestigation = sarUpload.status === "selected";

  const startInvestigation = useCallback(() => {
    if (sarUpload.status !== "selected") return;
    setInvestigationStarted(true);
  }, [sarUpload.status]);

  const toggleLayer = useCallback((id: MapLayerId) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === id ? { ...layer, active: !layer.active } : layer
      )
    );
  }, []);

  return {
    caseName,
    setCaseName,
    sarUpload,
    selectSarFile,
    rejectSarFile,
    clearSarFile,
    investigationStarted,
    canStartInvestigation,
    startInvestigation,
    stages,
    layers,
    toggleLayer,
  };
}
