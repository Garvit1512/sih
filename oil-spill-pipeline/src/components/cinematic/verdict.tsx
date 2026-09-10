"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";

const STAGE = stageById("verdict");

const EVIDENCE_ROWS = [
  { label: "SAR signal", value: "Look-alike confidence" },
  { label: "Slick features", value: "Irregular, wind-aligned" },
  { label: "Drift model", value: "Consistent hindcast" },
  { label: "AIS lineup", value: "Candidates in corridor" },
];

export function VerdictOverlay({
  scrollYProgress,
  reducedMotion,
}: {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // Fades out within its own range so the closing CTA owns the final
  // screen alone — no stage text lingering behind the hand-off.
  const { opacity, y } = useStageOverlayStyle(scrollYProgress, STAGE.range, {
    reducedMotion,
  });

  return (
    <motion.div
      style={{ opacity, y: reducedMotion ? 0 : y }}
      className="pointer-events-none absolute right-6 top-[20%] w-[min(90vw,20rem)] md:right-16"
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/45">
        06 / VERDICT
      </p>
      <h2 className="mt-2.5 text-[23px] font-medium leading-[1.22] tracking-[-0.015em] text-white/92">
        Investigator&rsquo;s dossier
      </h2>
      <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-white/50">
        Four independent lines of evidence, converging on a single lead.
      </p>

      <ul className="mt-6 max-w-[300px] text-left">
        {EVIDENCE_ROWS.map((row, index) => (
          <li key={row.label} className="relative pl-5">
            {/* Connector rail — the convergence, drawn rather than described */}
            <span
              aria-hidden
              className={cn(
                "absolute left-[3px] top-0 w-px bg-gradient-to-b from-[#4FB8D9]/40 to-[#4FB8D9]/15",
                index === EVIDENCE_ROWS.length - 1 ? "h-1/2" : "h-full"
              )}
            />
            <span
              aria-hidden
              className="absolute left-0 top-[7px] size-[7px] rounded-full border border-[#4FB8D9]/60 bg-[#05090f]"
            />
            <div className="flex items-baseline justify-between gap-3 pb-4">
              <span className="text-[12px] text-white/70">{row.label}</span>
              <span
                className={cn(
                  "text-[10.5px] text-white/55",
                  jetbrainsMono.className
                )}
              >
                {row.value}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <p className="max-w-[300px] border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/40">
        This is a decision-support lead list, not a legal determination.
      </p>
    </motion.div>
  );
}
