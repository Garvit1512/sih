"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import type { InvestigationStage } from "@/types/investigation";

interface StageListProps {
  stages: InvestigationStage[];
}

/**
 * Five-stage workflow list (oil-spill-pipeline/CLAUDE.md §6/§10). Active vs
 * locked is signaled by text + icon + border, not color alone (parent
 * CLAUDE.md §18 accessibility rule).
 */
export function StageList({ stages }: StageListProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {stages.map((stage) => {
        const isActive = stage.status === "active";
        return (
          <li key={stage.id}>
            <div
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-sm border-y border-r px-3 py-3 transition-colors",
                isActive
                  ? "border-[#4FB8D9]/35 border-l-2 border-l-[#4FB8D9] bg-[#4FB8D9]/[0.08] pl-[11px]"
                  : "border-white/[0.07] border-l-2 border-l-transparent bg-white/[0.015]"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 text-[11px]",
                  jetbrainsMono.className,
                  isActive ? "text-[#4FB8D9]" : "text-white/30"
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
                      isActive ? "text-white/95" : "text-white/55"
                    )}
                  >
                    {stage.label}
                  </p>
                  {isActive ? (
                    <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#4FB8D9]">
                      <span
                        className="size-1.5 rounded-full bg-[#4FB8D9]"
                        aria-hidden
                      />
                      Active
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium uppercase tracking-[0.1em] text-white/35">
                      <Lock className="size-2.5" aria-hidden />
                      Locked
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    "mt-0.5 truncate text-[10.5px]",
                    isActive ? "text-white/55" : "text-white/38"
                  )}
                >
                  {stage.subtitle}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
