"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { PHASE_ORDER, type PhaseId } from "@/lib/investigation-phases";
import type { InvestigationStage } from "@/types/investigation";

interface PhaseProgressProps {
  stages: InvestigationStage[];
  activePhase: PhaseId;
  revealedPhases: readonly PhaseId[];
  isPlaying: boolean;
  isComplete: boolean;
  onSelectPhase: (phase: PhaseId) => void;
  onPause: () => void;
  onResume: () => void;
  onReplay: () => void;
  onSkipToEnd: () => void;
}

/**
 * Compact sequence indicator: where the investigation is, what has already
 * been revealed, and a way back to any of it. Revealed phases are real
 * buttons — an investigator can re-read an earlier step without re-running
 * the case.
 */
export function PhaseProgress({
  stages,
  activePhase,
  revealedPhases,
  isPlaying,
  isComplete,
  onSelectPhase,
  onPause,
  onResume,
  onReplay,
  onSkipToEnd,
}: PhaseProgressProps) {
  const byId = new Map(stages.map((stage) => [stage.id, stage]));

  return (
    <div className="flex items-stretch overflow-hidden rounded-sm border border-white/[0.08] bg-[#0b0f16]/85 backdrop-blur-sm">
      <ol className="flex items-stretch">
        {PHASE_ORDER.map((phase, index) => {
          const stage = byId.get(phase);
          const revealed = revealedPhases.includes(phase);
          const isActive = phase === activePhase;
          const notApplicable = stage?.status === "unavailable";

          return (
            <li key={phase} className="flex items-stretch">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "my-auto h-px w-3 transition-colors",
                    revealed ? "bg-[#4FB8D9]/45" : "bg-white/10"
                  )}
                />
              )}
              <button
                type="button"
                disabled={!revealed}
                aria-current={isActive ? "step" : undefined}
                onClick={() => onSelectPhase(phase)}
                title={
                  revealed
                    ? `${stage?.label ?? phase} — ${stage?.subtitle ?? ""}`
                    : "Not yet reached"
                }
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 transition-colors",
                  revealed
                    ? "cursor-pointer hover:bg-white/[0.06]"
                    : "cursor-default",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    isActive
                      ? notApplicable
                        ? "bg-white/60"
                        : "bg-[#4FB8D9]"
                      : revealed
                        ? notApplicable
                          ? "bg-white/25"
                          : "bg-[#4FB8D9]/45"
                        : "bg-white/12"
                  )}
                />
                <span
                  className={cn(
                    "text-[9.5px] font-medium uppercase tracking-[0.12em] transition-colors",
                    isActive
                      ? "text-white/90"
                      : revealed
                        ? "text-white/50"
                        : "text-white/25"
                  )}
                >
                  {stage?.label ?? phase}
                </span>
                {revealed && notApplicable && (
                  <span
                    className={cn(
                      "text-[8.5px] tracking-[0.1em] text-white/30",
                      jetbrainsMono.className
                    )}
                  >
                    N/A
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex items-stretch border-l border-white/[0.08]">
        {!isComplete && (
          <>
            <ControlButton
              label={isPlaying ? "Pause the sequence" : "Resume the sequence"}
              onClick={isPlaying ? onPause : onResume}
            >
              {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
            </ControlButton>
            <ControlButton label="Skip to the dossier" onClick={onSkipToEnd}>
              <SkipForward className="size-3" />
            </ControlButton>
          </>
        )}
        <ControlButton label="Replay the sequence" onClick={onReplay}>
          <RotateCcw className="size-3" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex w-8 items-center justify-center text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/85 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
    >
      {children}
    </button>
  );
}
