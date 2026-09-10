"use client";

import { Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import type { CaseMeta } from "@/types/investigation";

interface CaseSelectorProps {
  cases: CaseMeta[];
  loading: boolean;
  error: string | null;
  selectedCaseId: string | null;
  onSelect: (caseId: string) => void;
  onRetry: () => void;
  disabled?: boolean;
}

/**
 * Prepared demonstration cases, straight from `GET /api/cases` — names and
 * regions are the backend's own, never hardcoded here.
 */
export function CaseSelector({
  cases,
  loading,
  error,
  selectedCaseId,
  onSelect,
  onRetry,
  disabled = false,
}: CaseSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
        Demo Investigation
      </p>

      {loading && (
        <div className="flex items-center gap-2 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/45">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Loading cases…
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-[#E2685C]/30 bg-[#E2685C]/[0.07] px-3 py-2.5"
        >
          <p className="text-[11px] leading-relaxed text-[#E2685C]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[#E2685C]/40 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#E2685C] transition-colors hover:bg-[#E2685C]/10"
          >
            <RotateCw className="size-3" aria-hidden />
            Retry
          </button>
        </div>
      )}

      {!loading && !error && cases.length === 0 && (
        <p className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/45">
          The backend returned no demonstration cases.
        </p>
      )}

      {!loading && !error && cases.length > 0 && (
        <ul className="space-y-1.5" role="radiogroup" aria-label="Demonstration case">
          {cases.map((demoCase) => {
            const isSelected = demoCase.case_id === selectedCaseId;
            return (
              <li key={demoCase.case_id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={disabled}
                  onClick={() => onSelect(demoCase.case_id)}
                  className={cn(
                    "w-full rounded-sm border-y border-r px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
                    isSelected
                      ? "border-[#4FB8D9]/35 border-l-2 border-l-[#4FB8D9] bg-[#4FB8D9]/[0.08] pl-[11px]"
                      : "border-white/[0.07] border-l-2 border-l-transparent bg-white/[0.015] hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-[11px]",
                        jetbrainsMono.className,
                        isSelected ? "text-[#4FB8D9]" : "text-white/45"
                      )}
                    >
                      {demoCase.case_id}
                    </span>
                    {demoCase.is_historical_ground_truth && (
                      <span className="shrink-0 text-[9px] uppercase tracking-[0.08em] text-white/35">
                        Historical
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      isSelected ? "text-white/85" : "text-white/55"
                    )}
                  >
                    {demoCase.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-white/35">
                    {demoCase.region}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
