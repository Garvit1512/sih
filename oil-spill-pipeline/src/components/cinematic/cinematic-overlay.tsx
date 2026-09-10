"use client";

import Link from "next/link";
import { motion, type MotionValue } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStageOverlayStyle } from "@/hooks/use-cinematic-scroll";
import { stageById } from "@/components/cinematic/stages";
import { SarAcquisitionOverlay } from "@/components/cinematic/sar-acquisition";
import { SlickDetectionOverlay } from "@/components/cinematic/slick-detection";
import { RuleOutOverlay } from "@/components/cinematic/rule-out";
import { BackwardDriftOverlay } from "@/components/cinematic/backward-drift";
import { AisLineupOverlay } from "@/components/cinematic/ais-lineup";
import { VerdictOverlay } from "@/components/cinematic/verdict";

const WORKSPACE_STAGE = stageById("workspace");
const OCEAN_STAGE = stageById("ocean");

interface CinematicOverlayProps {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}

export function CinematicOverlay({
  scrollYProgress,
  reducedMotion,
}: CinematicOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Edge scrims: narrative text is anchored left/right and regularly
          crosses the moonlit water, so each side gets a soft floor rather
          than a card behind every block. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[38%]"
        style={{
          background:
            "linear-gradient(to right, rgba(4,8,13,0.72) 0%, rgba(4,8,13,0.34) 45%, rgba(4,8,13,0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-[38%]"
        style={{
          background:
            "linear-gradient(to left, rgba(4,8,13,0.72) 0%, rgba(4,8,13,0.34) 45%, rgba(4,8,13,0) 100%)",
        }}
      />
      <HeroOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <SarAcquisitionOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <SlickDetectionOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <RuleOutOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <BackwardDriftOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <AisLineupOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <VerdictOverlay
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
      <WorkspaceCta
        scrollYProgress={scrollYProgress}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

function HeroOverlay({
  scrollYProgress,
  reducedMotion,
}: {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  // Starts fully visible at scroll zero, then clears the frame entirely
  // before SAR acquisition begins.
  const { opacity } = useStageOverlayStyle(scrollYProgress, OCEAN_STAGE.range, {
    holdBefore: true,
    reducedMotion,
  });

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
    >
      {/* Legibility scrim behind the title only — a soft radial darkening,
          not a visible box — so the text holds contrast against the ocean
          regardless of where waves/highlights happen to sit underneath. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 42% at 50% 46%, rgba(2,5,9,0.55) 0%, rgba(2,5,9,0) 100%)",
        }}
      />

      <h1 className="relative text-[28px] font-semibold uppercase leading-[1.14] tracking-[0.022em] text-white/95 md:text-[44px]">
        Oil Spill
        <br />
        Investigation Pipeline
      </h1>
      <p className="relative mt-5 max-w-[30rem] text-[13px] font-normal leading-relaxed text-white/50">
        Maritime intelligence for satellite-based spill investigation
      </p>
      <div className="absolute bottom-10 flex flex-col items-center gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/40">
          Scroll to investigate
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-white/35",
            !reducedMotion && "animate-bounce"
          )}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function WorkspaceCta({
  scrollYProgress,
  reducedMotion,
}: {
  scrollYProgress: MotionValue<number>;
  reducedMotion: boolean;
}) {
  const { opacity, y } = useStageOverlayStyle(
    scrollYProgress,
    WORKSPACE_STAGE.range,
    { holdAfter: true, reducedMotion }
  );

  return (
    <motion.div
      style={{ opacity, y: reducedMotion ? 0 : y }}
      className="absolute inset-x-0 bottom-[12%] flex flex-col items-center px-6 text-center"
    >
      <Link
        href="/investigate"
        className="pointer-events-auto inline-flex items-center gap-2 rounded-sm bg-[#4FB8D9] px-7 py-3 text-[12px] font-medium tracking-[0.02em] text-[#05090f] transition-colors hover:bg-[#6BC9DD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4FB8D9]"
      >
        Enter investigation workspace
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
      <p className="mt-4 max-w-xs text-[12px] leading-relaxed text-white/45">
        Review evidence, inspect layers, and continue the investigation.
      </p>
    </motion.div>
  );
}
