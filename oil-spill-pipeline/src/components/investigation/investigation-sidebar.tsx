"use client";

import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageList } from "@/components/investigation/stage-list";
import { SarUpload } from "@/components/investigation/sar-upload";
import type { InvestigationStage, SarUploadState } from "@/types/investigation";

interface InvestigationSidebarProps {
  caseName: string;
  onCaseNameChange: (value: string) => void;
  sarUpload: SarUploadState;
  onSelectSarFile: (file: File) => void;
  onRejectSarFile: (reason: string) => void;
  onClearSarFile: () => void;
  stages: InvestigationStage[];
  canStartInvestigation: boolean;
  investigationStarted: boolean;
  onStartInvestigation: () => void;
}

export function InvestigationSidebar({
  caseName,
  onCaseNameChange,
  sarUpload,
  onSelectSarFile,
  onRejectSarFile,
  onClearSarFile,
  stages,
  canStartInvestigation,
  investigationStarted,
  onStartInvestigation,
}: InvestigationSidebarProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0b0f16]/90 px-5 py-5 backdrop-blur-sm"
    >
      <div className="pb-5">
        <h1 className="text-sm font-semibold tracking-wide text-white/90">
          New Investigation
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
          Start a guided oil-spill attribution workflow.
        </p>
      </div>

      <div className="space-y-1.5 border-t border-white/[0.06] py-5">
        <label
          htmlFor="case-name"
          className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40"
        >
          Case Name
        </label>
        <input
          id="case-name"
          type="text"
          value={caseName}
          onChange={(event) => onCaseNameChange(event.target.value)}
          placeholder="e.g. Arabian Sea Slick — Sept 2026"
          className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-[#4FB8D9]/50 focus:bg-white/[0.05]"
        />
      </div>

      <div className="space-y-2 border-t border-white/[0.06] py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          Investigation Stages
        </p>
        <StageList stages={stages} />
      </div>

      <div className="border-t border-white/[0.06] py-5">
        <SarUpload
          value={sarUpload}
          onSelect={onSelectSarFile}
          onReject={onRejectSarFile}
          onClear={onClearSarFile}
        />
      </div>

      <p className="pb-4 text-[10.5px] leading-relaxed text-white/35">
        AI analysis will identify potential slick regions and calculate
        look-alike confidence.
      </p>

      <button
        type="button"
        disabled={!canStartInvestigation || investigationStarted}
        onClick={onStartInvestigation}
        className={cn(
          "mt-auto flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
          investigationStarted
            ? "cursor-default border border-[#4FB8D9]/30 bg-[#4FB8D9]/10 text-[#4FB8D9]"
            : canStartInvestigation
              ? "bg-[#4FB8D9] text-[#05070a] hover:bg-[#6BC9DD]"
              : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/25"
        )}
      >
        {investigationStarted ? (
          <>
            <CheckCircle2 className="size-3.5" aria-hidden />
            Investigation Started
          </>
        ) : (
          "Start Investigation"
        )}
      </button>
    </motion.aside>
  );
}
