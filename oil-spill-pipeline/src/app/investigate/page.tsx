"use client";

import { TopNavigation } from "@/components/layout/top-navigation";
import { InvestigationSidebar } from "@/components/investigation/investigation-sidebar";
import { InvestigationMap } from "@/components/map/investigation-map";
import { useInvestigation } from "@/hooks/use-investigation";
import { jetbrainsMono } from "@/lib/fonts";
import { cn } from "@/lib/utils";

const DATA_STREAM_ITEMS = [
  { id: "sar", label: "SAR" },
  { id: "ais", label: "AIS" },
  { id: "weather", label: "WEATHER" },
  { id: "infrastructure", label: "INFRASTRUCTURE" },
] as const;

export default function InvestigatePage() {
  const investigation = useInvestigation();

  return (
    <div className="flex h-full w-full flex-col">
      <TopNavigation />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <InvestigationMap
            investigationStarted={investigation.investigationStarted}
            layers={investigation.layers}
            onToggleLayer={investigation.toggleLayer}
          />
        </div>

        <InvestigationSidebar
          caseName={investigation.caseName}
          onCaseNameChange={investigation.setCaseName}
          sarUpload={investigation.sarUpload}
          onSelectSarFile={investigation.selectSarFile}
          onRejectSarFile={investigation.rejectSarFile}
          onClearSarFile={investigation.clearSarFile}
          stages={investigation.stages}
          canStartInvestigation={investigation.canStartInvestigation}
          investigationStarted={investigation.investigationStarted}
          onStartInvestigation={investigation.startInvestigation}
        />
      </div>

      <DataStreamsFooter investigationStarted={investigation.investigationStarted} />
    </div>
  );
}

function DataStreamsFooter({
  investigationStarted,
}: {
  investigationStarted: boolean;
}) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 bg-[#05070a] px-4 text-[10px] tracking-[0.12em] text-white/40">
      <div className="flex items-center gap-4">
        <span className="text-white/30">Data Streams</span>
        <div className="flex items-center gap-3">
          {DATA_STREAM_ITEMS.map((item) => (
            <span key={item.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  investigationStarted ? "bg-[#4FB8D9]" : "bg-white/20"
                )}
              />
              <span className={jetbrainsMono.className}>{item.label}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="text-white/30">Map Scale</span>
    </div>
  );
}
