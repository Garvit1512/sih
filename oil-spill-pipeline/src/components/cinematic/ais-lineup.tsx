"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("ais");

const CANDIDATES = [
  { id: "Candidate 01", note: "Track intersects probable drift corridor" },
  { id: "Candidate 02", note: "Track intersects probable drift corridor" },
  { id: "Candidate 03", note: "Partial AIS coverage in window" },
];

export function AisLineupOverlay({
  scrollYProgress,
  reducedMotion,
}: {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const { opacity, y } = useStageOverlayStyle(scrollYProgress, STAGE.range, {
    reducedMotion,
  });

  return (
    <motion.div
      style={{ opacity, y: reducedMotion ? 0 : y }}
      className="pointer-events-none absolute right-6 top-[28%] max-w-[15rem] md:right-16"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        05 / AIS LINEUP
      </p>
      <h2 className="mt-2.5 text-[21px] font-medium leading-[1.25] tracking-[-0.012em] text-white/92">
        Vessels within the modelled corridor
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-white/50">
        Synthetic AIS, for demonstration — not live vessel traffic.
      </p>
      <ul className="mt-5 space-y-3">
        {CANDIDATES.map((candidate) => (
          <li
            key={candidate.id}
            className="border-l border-white/15 pl-3"
          >
            <p
              className={cn(
                "text-[10.5px] tracking-[0.06em] text-white/70",
                jetbrainsMono.className
              )}
            >
              {candidate.id}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/40">
              {candidate.note}
            </p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
