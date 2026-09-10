"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import type { PhaseNarrative as Narrative } from "@/lib/investigation-phases";

const TONE_ACCENT: Record<Narrative["tone"], string> = {
  analytical: "bg-[#4FB8D9]",
  caution: "bg-[#D8A34E]",
  "not-applicable": "bg-white/25",
};

const TONE_TEXT: Record<Narrative["tone"], string> = {
  analytical: "text-white/90",
  caution: "text-[#EBC282]",
  "not-applicable": "text-white/55",
};

/**
 * The narrative annotation for the phase on screen.
 *
 * Anchored, small, and made entirely of values the backend returned — the
 * evidence lines are Stage B's and Stage D's own sentences, not a rewrite.
 */
export function PhaseNarrative({
  narrative,
  reducedMotion,
}: {
  narrative: Narrative | null;
  reducedMotion: boolean;
}) {
  return (
    <AnimatePresence mode="wait">
      {narrative && (
        <motion.figure
          key={narrative.id}
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-[420px]"
        >
          <div className="flex gap-3">
            <span
              aria-hidden
              className={cn("mt-1 w-px shrink-0", TONE_ACCENT[narrative.tone])}
            />

            <div className="min-w-0 rounded-sm bg-[#05070a]/72 px-3 py-2.5 backdrop-blur-[2px]">
              <p
                className={cn(
                  "text-[9px] tracking-[0.18em] text-white/35",
                  jetbrainsMono.className
                )}
              >
                PHASE {String(narrative.order).padStart(2, "0")}
              </p>

              <h2
                className={cn(
                  "mt-1 whitespace-pre-line text-[15px] font-semibold leading-tight tracking-[0.02em]",
                  TONE_TEXT[narrative.tone]
                )}
              >
                {narrative.headline}
              </h2>

              {narrative.detail && (
                <p className="mt-1 text-[11px] leading-snug text-white/50">
                  {narrative.detail}
                </p>
              )}

              {narrative.evidence.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {narrative.evidence.slice(0, 4).map((line, index) => (
                    <motion.li
                      key={line}
                      initial={reducedMotion ? false : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: reducedMotion ? 0 : 0.25 + index * 0.28,
                        ease: "easeOut",
                      }}
                      className="text-[11px] leading-relaxed text-white/45"
                    >
                      {line}
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </motion.figure>
      )}
    </AnimatePresence>
  );
}
