"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getCases,
  runInvestigation as runInvestigationRequest,
} from "@/services/api";
import type {
  CaseMeta,
  InvestigationCase,
  InvestigationStage,
  InvestigationStageId,
  InvestigationStageStatus,
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

const STAGE_DEFINITIONS: ReadonlyArray<{
  id: InvestigationStageId;
  order: number;
  label: string;
  subtitle: string;
}> = [
  { id: "detection", order: 1, label: "DETECTION", subtitle: "SAR Image Analysis" },
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
  { id: "lineup", order: 4, label: "LINEUP", subtitle: "AIS Vessel Attribution" },
  { id: "verdict", order: 5, label: "VERDICT", subtitle: "Investigator's Dossier" },
];

const DEFAULT_LAYERS: MapLayerToggle[] = [
  { id: "satellite", label: "SATELLITE", active: true },
  { id: "oceanographic", label: "OCEANOGRAPHIC", active: false },
  { id: "ais", label: "AIS", active: false },
  { id: "infrastructure", label: "INFRASTRUCTURE", active: false },
  { id: "weather", label: "WEATHER", active: false },
];

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

const IDLE_UPLOAD: SarUploadState = {
  status: "idle",
  file: null,
  rejectionReason: null,
};

/**
 * Derives stage state from the actual backend result — never from a local
 * flag. A stage is `complete` when the backend returned data for it, and
 * `unavailable` when the pipeline deliberately skipped it (Stage D on a
 * platform/pipeline source is a valid system state, not an error — PRD §38).
 */
function deriveStages(investigation: InvestigationCase | null): InvestigationStage[] {
  return STAGE_DEFINITIONS.map((stage) => {
    let status: InvestigationStageStatus = "locked";
    let note: string | null = null;

    if (!investigation) {
      status = stage.id === "detection" ? "active" : "locked";
      return { ...stage, status, note };
    }

    switch (stage.id) {
      case "detection":
        status = investigation.detection ? "complete" : "unavailable";
        break;
      case "rule-out":
        status = investigation.triage ? "complete" : "unavailable";
        break;
      case "time-travel":
        status = investigation.drift ? "complete" : "unavailable";
        break;
      case "lineup": {
        const attribution = investigation.attribution;
        if (!attribution) {
          status = "unavailable";
        } else if (attribution.executed) {
          status = "complete";
        } else {
          // Skipped on purpose — surface the backend's own reason.
          status = "unavailable";
          note = attribution.reason;
        }
        break;
      }
      case "verdict":
        status = investigation.report ? "complete" : "unavailable";
        break;
    }

    return { ...stage, status, note };
  });
}

/**
 * Investigation workspace state.
 *
 * Prepared demonstration cases come from `GET /api/cases`; running one calls
 * `POST /api/investigation/run` and the response becomes the single source of
 * truth for every downstream display. Nothing is synthesised locally.
 */
export function useInvestigation() {
  const [caseName, setCaseName] = useState("");
  const [sarUpload, setSarUpload] = useState<SarUploadState>(IDLE_UPLOAD);
  const [layers, setLayers] = useState<MapLayerToggle[]>(DEFAULT_LAYERS);

  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [investigation, setInvestigation] = useState<InvestigationCase | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const applyCases = useCallback((result: CaseMeta[]) => {
    setCases(result);
    setSelectedCaseId((current) => current ?? result[0]?.case_id ?? null);
  }, []);

  /** Retry path, invoked from an event handler. */
  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    setCasesError(null);
    try {
      applyCases(await getCases());
    } catch (error) {
      setCasesError(describeError(error, "Could not load demonstration cases."));
    } finally {
      setCasesLoading(false);
    }
  }, [applyCases]);

  // Initial load. State is only touched after the await, so this doesn't
  // trigger the cascading synchronous-setState-in-effect pattern.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getCases();
        if (!cancelled) applyCases(result);
      } catch (error) {
        if (!cancelled) {
          setCasesError(
            describeError(error, "Could not load demonstration cases.")
          );
        }
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyCases]);

  const selectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    // A previous run belongs to a different case — drop it rather than let
    // stale results sit under a newly selected case.
    setInvestigation(null);
    setRunError(null);
  }, []);

  const startInvestigation = useCallback(async () => {
    if (!selectedCaseId || isRunning) return;
    setIsRunning(true);
    setRunError(null);
    try {
      const result = await runInvestigationRequest(selectedCaseId);
      setInvestigation(result);
      if (result.status === "failed") {
        setRunError(result.error ?? "The investigation failed on the backend.");
      }
    } catch (error) {
      setInvestigation(null);
      setRunError(describeError(error, "The investigation could not be run."));
    } finally {
      setIsRunning(false);
    }
  }, [selectedCaseId, isRunning]);

  const selectSarFile = useCallback((file: File) => {
    setSarUpload({ status: "selected", file, rejectionReason: null });
  }, []);

  const rejectSarFile = useCallback((reason: string) => {
    setSarUpload({ status: "rejected", file: null, rejectionReason: reason });
  }, []);

  const clearSarFile = useCallback(() => {
    setSarUpload(IDLE_UPLOAD);
  }, []);

  const toggleLayer = useCallback((id: MapLayerId) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === id ? { ...layer, active: !layer.active } : layer
      )
    );
  }, []);

  const stages = useMemo(() => deriveStages(investigation), [investigation]);

  return {
    caseName,
    setCaseName,

    cases,
    casesLoading,
    casesError,
    selectedCaseId,
    selectCase,
    reloadCases: loadCases,

    investigation,
    isRunning,
    runError,
    startInvestigation,
    canStartInvestigation: Boolean(selectedCaseId) && !isRunning,

    sarUpload,
    selectSarFile,
    rejectSarFile,
    clearSarFile,

    stages,
    layers,
    toggleLayer,
  };
}
