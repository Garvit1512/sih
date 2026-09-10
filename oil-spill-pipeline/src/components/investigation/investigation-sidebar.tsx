"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ChevronDown, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { StageList } from "@/components/investigation/stage-list";
import { SarUpload } from "@/components/investigation/sar-upload";
import { CaseSelector } from "@/components/investigation/case-selector";
import { PhasePanel } from "@/components/investigation/phase-panel";
import type { InvestigationPlayback } from "@/hooks/use-investigation-playback";
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
  playback: InvestigationPlayback;
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
  playback,
}: InvestigationSidebarProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const hasResult = investigation !== null && investigation.status !== "failed";

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[#0b0f16]/90 px-5 py-5 backdrop-blur-sm"
    >
      {hasResult && investigation ? (
        <ActiveInvestigation
          investigation={investigation}
          stages={stages}
          playback={playback}
          reducedMotion={reducedMotion}
        />
      ) : (
        <CaseSetup
          caseName={caseName}
          onCaseNameChange={onCaseNameChange}
          cases={cases}
          casesLoading={casesLoading}
          casesError={casesError}
          selectedCaseId={selectedCaseId}
          onSelectCase={onSelectCase}
          onReloadCases={onReloadCases}
          isRunning={isRunning}
          stages={stages}
          sarUpload={sarUpload}
          onSelectSarFile={onSelectSarFile}
          onRejectSarFile={onRejectSarFile}
          onClearSarFile={onClearSarFile}
        />
      )}

      {runError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-[#E2685C]/30 bg-[#E2685C]/[0.07] px-3 py-2.5 text-[11px] leading-relaxed text-[#E2685C]"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{runError}</span>
        </div>
      )}

      {/* Re-running a completed case restarts the reveal from phase 01. */}
      <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
        {hasResult && (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white/70">
              Case setup
              <ChevronDown
                className="size-3 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="space-y-4 pt-4">
              <CaseSelector
                cases={cases}
                loading={casesLoading}
                error={casesError}
                selectedCaseId={selectedCaseId}
                onSelect={onSelectCase}
                onRetry={onReloadCases}
                disabled={isRunning}
              />
              <SarUpload
                value={sarUpload}
                onSelect={onSelectSarFile}
                onReject={onRejectSarFile}
                onClear={onClearSarFile}
              />
            </div>
          </details>
        )}

        <button
          type="button"
          disabled={!canStartInvestigation}
          onClick={onStartInvestigation}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
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
              Compiling investigation…
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
      </div>
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ */

function ActiveInvestigation({
  investigation,
  stages,
  playback,
  reducedMotion,
}: {
  investigation: InvestigationCase;
  stages: InvestigationStage[];
  playback: InvestigationPlayback;
  reducedMotion: boolean;
}) {
  return (
    <>
      <header className="pb-4">
        <p
          className={cn(
            "text-[10px] tracking-[0.16em] text-[#4FB8D9]",
            jetbrainsMono.className
          )}
        >
          {investigation.case_meta.case_id}
        </p>
        <h1 className="mt-1 text-[13px] font-semibold leading-snug text-white/90">
          {investigation.case_meta.name}
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
          {investigation.case_meta.region}
        </p>
      </header>

      <div className="space-y-2 border-t border-white/[0.06] py-4">
        <StageList
          stages={stages}
          activePhase={playback.activePhase}
          revealedPhases={playback.revealedPhases}
          onSelectPhase={playback.selectPhase}
        />
      </div>

      <div className="min-h-[280px] border-t border-white/[0.06] pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={playback.activePhase}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <PhasePanel
              phase={playback.activePhase}
              investigation={investigation}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

function CaseSetup({
  caseName,
  onCaseNameChange,
  cases,
  casesLoading,
  casesError,
  selectedCaseId,
  onSelectCase,
  onReloadCases,
  isRunning,
  stages,
  sarUpload,
  onSelectSarFile,
  onRejectSarFile,
  onClearSarFile,
}: {
  caseName: string;
  onCaseNameChange: (value: string) => void;
  cases: CaseMeta[];
  casesLoading: boolean;
  casesError: string | null;
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  onReloadCases: () => void;
  isRunning: boolean;
  stages: InvestigationStage[];
  sarUpload: SarUploadState;
  onSelectSarFile: (file: File) => void;
  onRejectSarFile: (reason: string) => void;
  onClearSarFile: () => void;
}) {
  return (
    <>
      <div className="pb-5">
        <h1 className="text-sm font-semibold tracking-wide text-white/90">
          New Investigation
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
          Start a guided oil-spill attribution workflow. Evidence is revealed
          one phase at a time.
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

      <div className="border-t border-white/[0.06] pt-5">
        <SarUpload
          value={sarUpload}
          onSelect={onSelectSarFile}
          onReject={onRejectSarFile}
          onClear={onClearSarFile}
        />
      </div>
    </>
  );
}
