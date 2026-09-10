"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("drift");

export function BackwardDriftOverlay({
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
      className="pointer-events-none absolute left-6 top-[30%] max-w-[16rem] md:left-16"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        04 / BACKWARD DRIFT
      </p>
      <h2 className="mt-2.5 text-[23px] font-medium leading-[1.22] tracking-[-0.015em] text-white/92">
        Probable drift path
      </h2>
      <p className="mt-3 max-w-[240px] text-[13px] leading-relaxed text-white/50">
        A hindcast reconstruction — a modeled path, not an exact spill
        origin.
      </p>
      <div
        className={cn(
          "mt-6 flex w-fit flex-col gap-1.5 text-[11px] text-white/45",
          jetbrainsMono.className
        )}
      >
        <span className="text-white/30">Hindcast</span>
        <span>T−06 h</span>
        <span>T−12 h</span>
        <span>T−18 h</span>
      </div>
    </motion.div>
  );
}
