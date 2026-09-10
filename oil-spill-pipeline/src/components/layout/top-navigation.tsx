"use client";

import type { ReactNode } from "react";
import { HelpCircle, Radar, Settings, UserCircle } from "lucide-react";

export function TopNavigation() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#05070a] px-4">
      <div className="flex items-center gap-3">
        <Radar className="size-4 text-[#4FB8D9]" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
          Oil Spill Investigation Pipeline
        </span>
        <span className="ml-1 flex items-center gap-1.5 border-l border-white/10 pl-3 text-[10px] uppercase tracking-[0.12em] text-white/35">
          <span className="size-1.5 rounded-full bg-[#4FBE87]" aria-hidden />
          System Online
        </span>
      </div>

      <nav className="flex items-center gap-1" aria-label="Primary">
        <button
          type="button"
          className="rounded-sm px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/40 transition-colors hover:bg-white/[0.05] hover:text-white/70"
        >
          Case
        </button>
        <button
          type="button"
          aria-current="page"
          className="rounded-sm border border-[#4FB8D9]/30 bg-[#4FB8D9]/[0.06] px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#4FB8D9]"
        >
          New Investigation
        </button>
      </nav>

      <div className="flex items-center gap-1">
        <NavIconButton label="Telemetry link active">
          <span className="size-2 rounded-full bg-[#4FBE87]" />
        </NavIconButton>
        <NavIconButton label="Profile">
          <UserCircle className="size-4" />
        </NavIconButton>
        <NavIconButton label="Settings">
          <Settings className="size-4" />
        </NavIconButton>
        <NavIconButton label="Help">
          <HelpCircle className="size-4" />
        </NavIconButton>
      </div>
    </header>
  );
}

function NavIconButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]"
    >
      {children}
    </button>
  );
}
