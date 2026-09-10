"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("rule-out");

export function RuleOutOverlay({
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
      className="pointer-events-none absolute bottom-[16%] right-6 max-w-[15rem] text-right md:right-16"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        03 / RULE-OUT
      </p>
      <h2 className="mt-2.5 text-[21px] font-medium leading-[1.25] tracking-[-0.012em] text-white/92">
        Infrastructure &amp; source-type triage
      </h2>
      <p className="ml-auto mt-3 max-w-[220px] text-[13px] leading-relaxed text-white/50">
        Before treating this as a vessel-sourced event, nearby stationary
        infrastructure is checked.
      </p>
      <dl
        className={cn(
          "mt-5 space-y-1.5 text-[11.5px] text-white/62",
          jetbrainsMono.className
        )}
      >
        <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-1.5">
          <dt className="text-white/38">Nearest platform</dt>
          <dd>41.2 km</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-1.5">
          <dt className="text-white/38">Nearest pipeline</dt>
          <dd>68.7 km</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-white/38">Assessment</dt>
          <dd className="text-white/72">No stationary source in range</dd>
        </div>
      </dl>
    </motion.div>
  );
}
