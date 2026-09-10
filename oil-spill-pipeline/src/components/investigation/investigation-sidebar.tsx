"use client";

import { motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageList } from "@/components/investigation/stage-list";
import { SarUpload } from "@/components/investigation/sar-upload";
import { CaseSelector } from "@/components/investigation/case-selector";
import { InvestigationResults } from "@/components/investigation/investigation-results";
import type {
  CaseMeta,
  InvestigationCase,
  InvestigationStage,
  SarUploadState,
} from "@/types/investigation";

interface InvestigationSidebarProps {
  caseName: string;
  onCaseNameChange: (value: string) => void;

  cases: CaseMeta[];
  casesLoading: boolean;
  casesError: string | null;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onReloadCases: () => void;

  investigation: InvestigationCase | null;
  isRunning: boolean;
  runError: string | null;
  onStartInvestigation: () => void;
  canStartInvestigation: boolean;

  sarUpload: SarUploadState;
  onSelectSarFile: (file: File) => void;
  onRejectSarFile: (reason: string) => void;
  onClearSarFile: () => void;

  stages: InvestigationStage[];
}

export function InvestigationSidebar({
  caseName,
  onCaseNameChange,
  cases,
  casesLoading,
  casesError,
  selectedCaseId,
  onSelectCase,
  onReloadCases,
  investigation,
  isRunning,
  runError,
  onStartInvestigation,
  canStartInvestigation,
  sarUpload,
  onSelectSarFile,
  onRejectSarFile,
  onClearSarFile,
  stages,
}: InvestigationSidebarProps) {
  const hasResult = investigation !== null && investigation.status !== "failed";

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

      <div className="border-t border-white/[0.06] py-5">
        <CaseSelector
          cases={cases}
          loading={casesLoading}
          error={casesError}
          selectedCaseId={selectedCaseId}
          onSelect={onSelectCase}
          onRetry={onReloadCases}
          disabled={isRunning}
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

      {runError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-[#E2685C]/30 bg-[#E2685C]/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-[#E2685C]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{runError}</span>
        </div>
      )}

      <button
        type="button"
        disabled={!canStartInvestigation}
        onClick={onStartInvestigation}
        className={cn(
          "flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
          isRunning
            ? "cursor-wait border border-[#4FB8D9]/30 bg-[#4FB8D9]/10 text-[#4FB8D9]"
            : canStartInvestigation
              ? "bg-[#4FB8D9] text-[#05070a] hover:bg-[#6BC9DD]"
              : "cursor-not-allowed border border-white/10 bg-white/[0.03] text-white/25"
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Running investigation…
          </>
        ) : hasResult ? (
          <>
            <Play className="size-3.5" aria-hidden />
            Re-run investigation
          </>
        ) : (
          "Start Investigation"
        )}
      </button>

      {hasResult && investigation && (
        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <div className="mb-4 flex items-center gap-2 text-[11px] text-[#4FB8D9]">
            <CheckCircle2 className="size-3.5" aria-hidden />
            <span>
              {investigation.case_meta.case_id} · {investigation.status}
            </span>
          </div>
          <InvestigationResults investigation={investigation} />
        </div>
      )}
    </motion.aside>
  );
}
