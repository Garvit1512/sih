"use client";

import { useRef, useState } from "react";
import { type MotionValue, useMotionValueEvent } from "motion/react";
import { cn } from "@/lib/utils";
import { CINEMATIC_STAGES } from "@/components/cinematic/stages";

function stageIndexForProgress(progress: number): number {
  let index = 0;
  for (const stage of CINEMATIC_STAGES) {
    if (progress >= stage.range[0]) index = stage.index;
  }
  return index;
}

/**
 * A quiet vertical progress rail — the only piece of persistent chrome in
 * the cinematic sequence. Updates React state only on stage-boundary
 * crossings (a handful of times across the whole scroll), not per scroll
 * tick. Purely decorative (each stage's own heading already says where you
 * are), so it's hidden from assistive tech.
 */
export function InvestigationTimeline({
  scrollYProgress,
}: {
  scrollYProgress: MotionValue<number>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndex = useRef(0);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = stageIndexForProgress(value);
    if (next !== lastIndex.current) {
      lastIndex.current = next;
      setActiveIndex(next);
    }
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 md:flex"
    >
      {/* Tick marks only — the numerals read as debug output, and each
          stage already names itself in the narrative overlay. */}
      {CINEMATIC_STAGES.map((stage) => {
        const isActive = stage.index === activeIndex;
        return (
          <span
            key={stage.id}
            className={cn(
              "h-px transition-all duration-500",
              isActive ? "w-4 bg-white/55" : "w-2 bg-white/15"
            )}
          />
        );
      })}
    </div>
  );
}
