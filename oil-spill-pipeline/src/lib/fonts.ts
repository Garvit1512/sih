import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Typography for the /investigate workspace only (oil-spill-pipeline/CLAUDE.md
 * §2). Scoped here rather than in the root layout so the `/` route keeps its
 * existing fonts untouched.
 */
export const interFont = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Coordinates, telemetry, and other technical values. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
