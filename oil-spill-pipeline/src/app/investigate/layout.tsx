import type { Metadata } from "next";
import type { ReactNode } from "react";
import { manropeFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Investigation Workspace | Oil Spill Investigation Pipeline",
  description:
    "Operational maritime intelligence workstation for oil-spill source investigation.",
};

/**
 * Scoped to /investigate so the `/` route's fonts and layout stay untouched
 * (oil-spill-pipeline/CLAUDE.md §6/§7 — two distinct experiences).
 */
export default function InvestigateLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${manropeFont.className} h-dvh w-full overflow-hidden bg-[#05070a] text-white/90 antialiased`}
    >
      {children}
    </div>
  );
}
