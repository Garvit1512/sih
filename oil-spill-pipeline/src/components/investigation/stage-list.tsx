"use client";

import { CheckCircle2, Lock, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import type { PhaseId } from "@/lib/investigation-phases";
import type { InvestigationStage } from "@/types/investigation";

interface StageListProps {
  stages: InvestigationStage[];
  /** The phase on screen; absent before an investigation has been run. */
  activePhase?: PhaseId | null;
  /** Phases the reveal sequence has reached — the ones that can be revisited. */
  revealedPhases?: readonly PhaseId[];
  onSelectPhase?: (phase: PhaseId) => void;
}

/**
 * Stage state is derived from actual backend results, never from a local
 * flag. `unavailable` means the pipeline ran but deliberately produced no
 * data for that stage (e.g. attribution skipped for a stationary source) —
 * a valid system state, not an error (CLAUDE.md §38).
 *
 * Once a phase has been revealed it becomes a button, so an investigator can
 * step back through the evidence without re-running the case.
 */
export function StageList({
  stages,
  activePhase = null,
  revealedPhases = [],
  onSelectPhase,
}: StageListProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {stages.map((stage) => {
        const isOnScreen = stage.id === activePhase;
        const isRevealed = revealedPhases.includes(stage.id);
        const isComplete = stage.status === "complete";
        const isUnavailable = stage.status === "unavailable";
        // Before a run, the first stage is merely "next up"; after one, the
        // highlight follows the phase the investigator is actually looking at.
        const highlighted = activePhase ? isOnScreen : stage.status === "active";
        const selectable = Boolean(onSelectPhase) && isRevealed;

        const body = (
          <>
            <span
              className={cn(
                "mt-0.5 shrink-0 text-[11px]",
                jetbrainsMono.className,
                highlighted ? "text-[#4FB8D9]" : isRevealed ? "text-white/45" : "text-white/30"
              )}
              aria-hidden
            >
              {String(stage.order).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "truncate text-[11px] font-semibold uppercase tracking-[0.1em]",
                    highlighted ? "text-white/95" : isRevealed ? "text-white/70" : "text-white/55"
                  )}
                >
                  {stage.label}
                </p>
                <StageBadge
                  status={stage.status}
                  onScreen={isOnScreen}
                  complete={isComplete}
                />
              </div>

              <p
                className={cn(
                  "mt-0.5 truncate text-[10.5px]",
                  highlighted ? "text-white/55" : "text-white/38"
                )}
              >
                {stage.subtitle}
              </p>

              {/* The backend's own reason for skipping, when it gave one. */}
              {isUnavailable && stage.note && (
                <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                  {stage.note}
                </p>
              )}
            </div>
          </>
        );

        const shellClass = cn(
          "flex w-full items-start gap-3 rounded-sm border-y border-r px-3 py-3 text-left transition-colors",
          highlighted
            ? "border-[#4FB8D9]/35 border-l-2 border-l-[#4FB8D9] bg-[#4FB8D9]/[0.08] pl-[11px]"
            : "border-white/[0.07] border-l-2 border-l-transparent bg-white/[0.015]",
          selectable && !highlighted && "hover:bg-white/[0.04]"
        );

        return (
          <li key={stage.id}>
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelectPhase?.(stage.id)}
                aria-current={isOnScreen ? "step" : undefined}
                className={cn(
                  shellClass,
                  "cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
                )}
              >
                {body}
              </button>
            ) : (
              <div
                aria-current={stage.status === "active" ? "step" : undefined}
                className={shellClass}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StageBadge({
  status,
  onScreen,
  complete,
}: {
  status: InvestigationStage["status"];
  onScreen: boolean;
  complete: boolean;
}) {
  if (onScreen && complete) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4FB8D9]">
        <span className="size-1.5 rounded-full bg-[#4FB8D9]" aria-hidden />
        On screen
      </span>
    );
  }

  if (status === "complete") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4FB8D9]">
        <CheckCircle2 className="size-2.5" aria-hidden />
        Complete
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4FB8D9]">
        <span className="size-1.5 rounded-full bg-[#4FB8D9]" aria-hidden />
        Active
      </span>
    );
  }

  if (status === "unavailable") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-white/40">
        <MinusCircle className="size-2.5" aria-hidden />
        Not applicable
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-white/35">
      <Lock className="size-2.5" aria-hidden />
      Locked
    </span>
  );
}
