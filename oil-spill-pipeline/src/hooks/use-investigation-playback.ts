"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PHASE_DWELL_MS,
  PHASE_ORDER,
  buildPhaseNarratives,
  type PhaseId,
  type PhaseNarrative,
} from "@/lib/investigation-phases";
import type { InvestigationCase } from "@/types/investigation";

export interface InvestigationPlayback {
  /** The phase currently on screen. */
  readonly activePhase: PhaseId;
  /** Phases the sequence has reached — the only ones a user may jump to. */
  readonly revealedPhases: readonly PhaseId[];
  /** True while the sequence is advancing on its own. */
  readonly isPlaying: boolean;
  /** True once the last phase has been reached. */
  readonly isComplete: boolean;
  readonly narratives: Record<PhaseId, PhaseNarrative> | null;
  selectPhase: (phase: PhaseId) => void;
  /** Pauses auto-advance without moving the camera. */
  pause: () => void;
  /** Resumes from the active phase, revealing the rest. */
  resume: () => void;
  /** Restarts the reveal from the first phase. */
  replay: () => void;
  /** Jumps straight to the dossier, revealing everything. */
  skipToEnd: () => void;
}

const LAST_INDEX = PHASE_ORDER.length - 1;

/**
 * Drives the progressive reveal of a completed investigation.
 *
 * The backend returns the whole `InvestigationCase` in one call, so this hook
 * governs only *when* each already-known result is shown — it never gates,
 * refetches or re-derives any stage output. Auto-advance stops the moment the
 * investigator takes control, so the sequence can't move the map out from
 * under someone reading it.
 */
export function useInvestigationPlayback(
  investigation: InvestigationCase | null
): InvestigationPlayback {
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Identity of the run being played back. Re-running the same case should
  // restart the sequence, so this tracks the object, not the case id.
  const runRef = useRef<InvestigationCase | null>(null);

  useEffect(() => {
    if (runRef.current === investigation) return;
    runRef.current = investigation;

    const playable = investigation !== null && investigation.status !== "failed";
    setActiveIndex(0);
    setRevealedIndex(0);
    setIsPlaying(playable);
  }, [investigation]);

  useEffect(() => {
    if (!isPlaying || activeIndex >= LAST_INDEX) return;

    const dwell = PHASE_DWELL_MS[PHASE_ORDER[activeIndex]];
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => Math.min(current + 1, LAST_INDEX));
      setRevealedIndex((current) => Math.min(Math.max(current, activeIndex + 1), LAST_INDEX));
    }, dwell);

    return () => window.clearTimeout(timer);
  }, [isPlaying, activeIndex]);

  // Reaching the final phase ends the sequence rather than leaving a timer
  // spinning against a zero dwell.
  useEffect(() => {
    if (activeIndex >= LAST_INDEX) setIsPlaying(false);
  }, [activeIndex]);

  const selectPhase = useCallback(
    (phase: PhaseId) => {
      const index = PHASE_ORDER.indexOf(phase);
      if (index < 0 || index > revealedIndex) return;
      setIsPlaying(false);
      setActiveIndex(index);
    },
    [revealedIndex]
  );

  const pause = useCallback(() => setIsPlaying(false), []);

  const resume = useCallback(() => {
    if (activeIndex >= LAST_INDEX) return;
    setIsPlaying(true);
  }, [activeIndex]);

  const replay = useCallback(() => {
    if (!investigation || investigation.status === "failed") return;
    setActiveIndex(0);
    setRevealedIndex(0);
    setIsPlaying(true);
  }, [investigation]);

  const skipToEnd = useCallback(() => {
    if (!investigation || investigation.status === "failed") return;
    setIsPlaying(false);
    setRevealedIndex(LAST_INDEX);
    setActiveIndex(LAST_INDEX);
  }, [investigation]);

  const narratives = useMemo(
    () => buildPhaseNarratives(investigation),
    [investigation]
  );

  const revealedPhases = useMemo(
    () => PHASE_ORDER.slice(0, revealedIndex + 1),
    [revealedIndex]
  );

  return {
    activePhase: PHASE_ORDER[activeIndex],
    revealedPhases,
    isPlaying,
    isComplete: revealedIndex >= LAST_INDEX,
    narratives,
    selectPhase,
    pause,
    resume,
    replay,
    skipToEnd,
  };
}
