/**
 * Brand fonts. This is the ONLY file to change when the licensed "Nove" web font arrives:
 * swap `display` for `next/font/local` and keep the `--font-display` variable.
 * (See docs/DECISIONS.md D11.)
 */
import { Cormorant_Garamond, Jost } from "next/font/google";

/** Light, high-contrast editorial serif — headlines, taglines (italic). Stand-in for "Nove". */
export const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

/** Geometric sans — letter-spaced labels, navigation, body copy and admin UI. */
export const sans = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans-ui",
  display: "swap",
});

export const fontVariables = `${display.variable} ${sans.variable}`;
