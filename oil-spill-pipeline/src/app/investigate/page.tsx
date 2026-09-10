"use client";

import { TopNavigation } from "@/components/layout/top-navigation";
import { InvestigationSidebar } from "@/components/investigation/investigation-sidebar";
import { InvestigationMap } from "@/components/map/investigation-map";
import { useInvestigation } from "@/hooks/use-investigation";
import { jetbrainsMono } from "@/lib/fonts";
import { cn } from "@/lib/utils";

/** Shown dimmed until a run reports what actually produced each stage. */
const PROVENANCE_ORDER = [
  "detection",
  "triage",
  "drift",
  "attribution",
  "infrastructure",
] as const;

export default function InvestigatePage() {
  const investigation = useInvestigation();
  // Only a genuine, non-failed backend result counts as "started".
  const hasResult =
    investigation.investigation !== null &&
    investigation.investigation.status !== "failed";

  return (
    <div className="flex h-full w-full flex-col">
      <TopNavigation />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <InvestigationMap
            sarFile={investigation.sarUpload.file}
            investigation={investigation.investigation}
            investigationStarted={hasResult}
            stages={investigation.stages}
            playback={investigation.playback}
            layers={investigation.layers}
            onToggleLayer={investigation.toggleLayer}
          />
        </div>

        <InvestigationSidebar
          caseName={investigation.caseName}
          onCaseNameChange={investigation.setCaseName}
          cases={investigation.cases}
          casesLoading={investigation.casesLoading}
          casesError={investigation.casesError}
          selectedCaseId={investigation.selectedCaseId}
          onSelectCase={investigation.selectCase}
          onReloadCases={investigation.reloadCases}
          investigation={investigation.investigation}
          isRunning={investigation.isRunning}
          runError={investigation.runError}
          onStartInvestigation={investigation.startInvestigation}
          canStartInvestigation={investigation.canStartInvestigation}
          sarUpload={investigation.sarUpload}
          onSelectSarFile={investigation.selectSarFile}
          onRejectSarFile={investigation.rejectSarFile}
          onClearSarFile={investigation.clearSarFile}
          stages={investigation.stages}
          playback={investigation.playback}
        />
      </div>

      <ProvenanceFooter
        provenance={hasResult ? investigation.investigation?.provenance ?? null : null}
      />
    </div>
  );
}

/**
 * What produced each stage of the result on screen (parent CLAUDE.md §40).
 * These strings are the backend's own provenance values — a mock provider
 * says so, rather than being presented as a real model.
 */
function ProvenanceFooter({
  provenance,
}: {
  provenance: Record<string, string> | null;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-[#05070a] px-4 text-[10px] text-white/40">
      <div className="flex min-w-0 items-center gap-4">
        <span className="shrink-0 tracking-[0.12em] text-white/30">Provenance</span>
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          {PROVENANCE_ORDER.map((key) => {
            const source = provenance?.[key] ?? null;
            return (
              <span key={key} className="flex shrink-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    source ? "bg-[#4FB8D9]" : "bg-white/20"
                  )}
                />
                <span className={cn("tracking-[0.06em]", jetbrainsMono.className)}>
                  {key.toUpperCase()}
                  {source && (
                    <span className="ml-1 text-white/28">{source}</span>
                  )}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Required positioning, kept in view throughout (CLAUDE.md §20). */}
      <span className="shrink-0 text-white/30">
        Decision-support lead list — not a legal determination.
      </span>
    </div>
  );
}
