"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("sar");

export function SarAcquisitionOverlay({
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
      className="pointer-events-none absolute left-6 top-[34%] max-w-[14rem] md:left-16 md:max-w-[15rem]"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        01 / SAR ACQUISITION
      </p>
      <h2 className="mt-2.5 text-[21px] font-medium leading-[1.25] tracking-[-0.012em] text-white/92">
        Satellite pass detected
      </h2>
      <dl
        className={cn(
          "mt-5 space-y-1.5 text-[11.5px] text-white/62",
          jetbrainsMono.className
        )}
      >
        <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-1.5">
          <dt className="text-white/38">Platform</dt>
          <dd>Sentinel-1</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-1.5">
          <dt className="text-white/38">Mode</dt>
          <dd>C-band SAR</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[0.07] pb-1.5">
          <dt className="text-white/38">Pass</dt>
          <dd>0147</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-white/38">Scene</dt>
          <dd>18.5421°N 72.8234°E</dd>
        </div>
      </dl>
    </motion.div>
  );
}
