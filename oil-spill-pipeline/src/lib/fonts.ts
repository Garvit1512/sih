import { JetBrains_Mono, Manrope } from "next/font/google";

/**
 * Typography system for the product surfaces.
 *
 * Manrope carries everything that speaks in language — hero title, stage
 * labels, headings, body copy. It's a humanist geometric sans with tight,
 * even proportions that reads as considered rather than futuristic.
 *
 * JetBrains Mono is reserved for genuine instrument data — coordinates,
 * timestamps, pass numbers, confidence values, vessel identifiers — where
 * fixed advance width actually helps you compare figures. It is never used
 * for headings.
 */
export const manropeFont = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

/** Coordinates, timestamps, and other technical readouts. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
