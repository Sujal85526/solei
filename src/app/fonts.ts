/**
 * Brand fonts. This is the ONLY file to change when the licensed "Nove" web font arrives:
 * swap `display` for `next/font/local` pointing at the font files and keep the `--font-display` variable.
 * (See docs/DECISIONS.md D11.)
 */
import { Bodoni_Moda, Inter } from "next/font/google";

/** High-contrast didone serif — headings, taglines (italic), letter-spaced labels. Stand-in for "Nove". */
export const display = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

/** Clean sans for UI, forms, admin and numbers. */
export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  display: "swap",
});

export const fontVariables = `${display.variable} ${sans.variable}`;
