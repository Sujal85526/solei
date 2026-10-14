/**
 * Solei palette — single source of truth for colour values.
 * `src/app/globals.css` mirrors these as CSS variables; `palette.test.ts` verifies WCAG contrast
 * for every text/background pair we actually use.
 */
export const palette = {
  /** Primary, dominant. Client-supplied. */
  burgundy: "#460328",
  /** Deeper burgundy for hover/pressed and footer. */
  burgundyDeep: "#2E021A",
  /** Near-black burgundy for body text on cream. */
  ink: "#24030F",
  /** Secondary text on cream. */
  inkMuted: "#6A4655",
  /** Accent: buttons, details, selected sections. Client-supplied. Never body text on cream. */
  pink: "#F7CDD0",
  /** Pale pink wash for selected rows / soft panels. */
  pinkWash: "#FBE7E8",
  /** Warm cream paper — page background (picked from company profile). */
  cream: "#F6EEE8",
  /** Slightly darker sand for alternating bands and cards. */
  sand: "#EFE3DA",
  /** Muted gold — hairlines, ornaments, large display only. */
  gold: "#B08D57",
  /** Darker gold usable for small text on cream (AA). */
  goldInk: "#7A5A2B",
  white: "#FFFFFF",
  /** Darkest wine-black — storefront base. */
  noir: "#170510",
  /** Deep wine — alternating dark sections and cards. */
  wine: "#2A0A16",
  /** Body text on dark. */
  pearl: "#F1E4DE",
  /** Secondary text on dark. */
  pearlMuted: "#C9AFB2",
  /** Error/destructive. */
  danger: "#A3172D",
  /** Success. */
  success: "#2F6B3F",
} as const;

export type PaletteKey = keyof typeof palette;

/** Text/background pairs used in the UI, with the minimum ratio required. */
export const contrastPairs: { fg: PaletteKey; bg: PaletteKey; min: number; use: string }[] = [
  { fg: "ink", bg: "cream", min: 4.5, use: "body text" },
  { fg: "inkMuted", bg: "cream", min: 4.5, use: "secondary text" },
  { fg: "inkMuted", bg: "sand", min: 4.5, use: "secondary text on sand bands" },
  { fg: "burgundy", bg: "cream", min: 4.5, use: "headings, links" },
  { fg: "burgundy", bg: "sand", min: 4.5, use: "headings on sand" },
  { fg: "burgundy", bg: "pink", min: 4.5, use: "pink button label" },
  { fg: "burgundy", bg: "pinkWash", min: 4.5, use: "selected rows" },
  { fg: "cream", bg: "burgundy", min: 4.5, use: "primary button, dark bands" },
  { fg: "pink", bg: "burgundy", min: 4.5, use: "accent text/logo on burgundy" },
  { fg: "pink", bg: "burgundyDeep", min: 4.5, use: "footer accents" },
  { fg: "cream", bg: "burgundyDeep", min: 4.5, use: "footer text" },
  { fg: "goldInk", bg: "cream", min: 4.5, use: "small gold labels" },
  { fg: "gold", bg: "burgundy", min: 3, use: "large gold display on burgundy" },
  { fg: "ink", bg: "white", min: 4.5, use: "admin surfaces" },
  { fg: "pink", bg: "noir", min: 4.5, use: "storefront headlines on noir" },
  { fg: "pink", bg: "wine", min: 4.5, use: "headlines on wine sections" },
  { fg: "pearl", bg: "noir", min: 4.5, use: "storefront body on noir" },
  { fg: "pearlMuted", bg: "noir", min: 4.5, use: "secondary text on noir" },
  { fg: "pearlMuted", bg: "wine", min: 4.5, use: "secondary text on wine" },
  { fg: "pearl", bg: "burgundy", min: 4.5, use: "body on burgundy" },
  { fg: "burgundy", bg: "pink", min: 4.5, use: "text on blush panels" },
  { fg: "danger", bg: "cream", min: 4.5, use: "error text" },
  { fg: "danger", bg: "white", min: 4.5, use: "error text in admin" },
  { fg: "success", bg: "white", min: 4.5, use: "success text in admin" },
];

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
