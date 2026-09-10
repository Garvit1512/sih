"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("slick");

const CONFIDENCE = 75;
const TICK_COUNT = 32;

/**
 * Segmented confidence arc — an instrument readout rather than a progress
 * bar or a dashboard card. Deliberately small: the number matters, but it
 * shouldn't dominate the frame.
 */
function ConfidenceDial({ value }: { value: number }) {
  const filled = Math.round((value / 100) * TICK_COUNT);

  return (
    <div className="relative size-[84px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const angle = (i / TICK_COUNT) * 360;
          const isFilled = i < filled;
          return (
            <line
              key={i}
              x1="50"
              y1="6"
              x2="50"
              y2={isFilled ? "14" : "12"}
              transform={`rotate(${angle} 50 50)`}
              stroke={isFilled ? "#4FB8D9" : "#ffffff"}
              strokeOpacity={isFilled ? 0.85 : 0.16}
              strokeWidth={isFilled ? 2.4 : 1.6}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "text-[17px] leading-none text-white/85",
            jetbrainsMono.className
          )}
        >
          {value}
          <span className="text-[10px] text-white/45">%</span>
        </span>
      </div>
    </div>
  );
}

export function SlickDetectionOverlay({
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
      className="pointer-events-none absolute right-6 top-[30%] max-w-[16rem] md:right-16"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        02 / SLICK DETECTION
      </p>
      <h2 className="mt-2.5 text-[21px] font-medium leading-[1.25] tracking-[-0.012em] text-white/92">
        Potential slick detected
      </h2>

      <div className="mt-5 flex items-center gap-4">
        <ConfidenceDial value={CONFIDENCE} />
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-white/40">
            Look-alike confidence
          </p>
          <p className="mt-1 max-w-[150px] text-[11px] leading-relaxed text-white/45">
            Indicative only — sample value, not a confirmed spill.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
