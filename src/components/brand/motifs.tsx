import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle travel motifs from the company profile. Decorative only: all are aria-hidden
 * unless they carry text. Keep them sparse — one or two per section at most.
 */

/** Wavy postal cancellation lines. */
export function PostmarkWaves({
  className,
  lines = 4,
  width = 160,
}: {
  className?: string;
  lines?: number;
  width?: number;
}) {
  const gap = 7;
  const height = (lines - 1) * gap + 8;
  const wave = (y: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < width; x += 20) d += ` q5 -4 10 0 t10 0`;
    return d;
  };
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-gold h-auto w-40", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {Array.from({ length: lines }, (_, i) => (
        <path key={i} d={wave(4 + i * gap)} />
      ))}
    </svg>
  );
}

/** Circular postmark with text set on the ring, e.g. "ABU DHABI · SOLEI". */
export function Postmark({
  top = "Abu Dhabi",
  bottom = "Made to remain",
  center = "UAE",
  className,
}: {
  top?: string;
  bottom?: string;
  center?: string;
  className?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 120 120" className={cn("text-gold size-28", className)}>
      <defs>
        <path id="pm-top" d="M18 60 a42 42 0 0 1 84 0" />
        <path id="pm-bottom" d="M14 60 a46 46 0 0 0 92 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <g fill="currentColor" style={{ fontFamily: "var(--font-display)", letterSpacing: "0.2em" }}>
        <text fontSize="9">
          <textPath href="#pm-top" startOffset="50%" textAnchor="middle">
            {top.toUpperCase()}
          </textPath>
        </text>
        <text fontSize="8">
          <textPath href="#pm-bottom" startOffset="50%" textAnchor="middle">
            {bottom.toUpperCase()}
          </textPath>
        </text>
        <text x="60" y="64" fontSize="11" textAnchor="middle">
          {center.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}

/** Thin arch with a palm — the profile's signature line drawing. */
export function ArchPalm({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 200"
      className={cn("text-gold h-48 w-auto", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
    >
      <path d="M8 198 V64 a52 52 0 0 1 104 0 V198" />
      <path d="M16 198 V66 a44 44 0 0 1 88 0 V198" opacity=".6" />
      {/* trunk */}
      <path d="M62 196 C60 160 58 128 61 92" strokeWidth="1.5" />
      <path d="M58 180 h6 M58 166 h6 M58 152 h5 M59 138 h5 M59 124 h5 M60 110 h4" opacity=".7" />
      {/* fronds */}
      <path d="M61 92 C48 80 34 80 22 90" />
      <path d="M61 92 C50 72 38 66 26 66" />
      <path d="M61 92 C58 72 52 58 42 50" />
      <path d="M61 92 C66 72 74 60 86 54" />
      <path d="M61 92 C74 78 88 76 98 82" />
      <path d="M61 92 C74 88 88 92 96 102" />
      <path d="M61 92 C50 90 38 96 30 106" />
    </svg>
  );
}

/** Gold hairline with a small four-point star in the middle (as on the destination postcards). */
export function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("text-gold flex items-center gap-3", className)}>
      <span className="h-px flex-1 bg-current opacity-70" />
      <svg viewBox="0 0 12 12" className="size-2.5 fill-current">
        <path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" />
      </svg>
      <span className="h-px flex-1 bg-current opacity-70" />
    </div>
  );
}

/** Letter-spaced small-caps label flanked by hairlines: — MADE TO REMAIN — */
export function Eyebrow({
  children,
  className,
  lines = false,
}: {
  children: ReactNode;
  className?: string;
  lines?: boolean;
}) {
  if (!lines) return <p className={cn("eyebrow text-gold-ink", className)}>{children}</p>;
  return (
    <p className={cn("eyebrow text-gold-ink flex items-center gap-4", className)}>
      <span aria-hidden className="h-px w-10 bg-current opacity-60" />
      {children}
      <span aria-hidden className="h-px w-10 bg-current opacity-60" />
    </p>
  );
}

/** Postage stamp: perforated edge around any content (image or text). */
export function StampFrame({
  children,
  className,
  perforation = 4,
  tone = "cream",
}: {
  children: ReactNode;
  className?: string;
  /** Radius of the perforation holes in px. */
  perforation?: number;
  tone?: "cream" | "white" | "pink" | "burgundy";
}) {
  const bg = {
    cream: "bg-[#FBF6F2]",
    white: "bg-white",
    pink: "bg-pink",
    burgundy: "bg-burgundy",
  }[tone];
  return (
    <div
      className={cn("perforated drop-shadow-sm", bg, className)}
      style={{ "--perf-r": `${perforation}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Postcard: cream card, gold inner rule, gentle shadow, optional tilt. */
export function PostcardFrame({
  children,
  className,
  tilt = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Rotation in degrees; keep within ±3. Disabled for reduced motion is not needed (static). */
  tilt?: number;
}) {
  return (
    <div
      className={cn(
        "relative bg-[#FBF6F2] p-2.5 shadow-[0_1px_2px_rgb(70_3_40/0.08),0_12px_32px_-12px_rgb(70_3_40/0.25)]",
        className,
      )}
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <div className="outline-gold/40 relative outline outline-1 -outline-offset-1">{children}</div>
    </div>
  );
}

/** Passport stamp — a destination sticker. Used by the loyalty passport and decoration. */
export function PassportStamp({
  label,
  sublabel,
  className,
  tilt = -6,
  variant = "ink",
  shape = "round",
  compact = false,
}: {
  label: string;
  sublabel?: string;
  className?: string;
  tilt?: number;
  variant?: "ink" | "filled" | "empty";
  shape?: "round" | "rect";
  /** Shrinks type on phones so long names (Santorini) fit small stamps. */
  compact?: boolean;
}) {
  const styles = {
    ink: "text-burgundy border-burgundy/70",
    filled: "bg-burgundy text-pink border-burgundy",
    empty: "text-ink-muted border-burgundy/25 border-dashed",
  }[variant];
  return (
    <div
      className={cn(
        "inline-flex aspect-square flex-col items-center justify-center gap-0.5 border-[1.5px] p-2 text-center",
        shape === "round" ? "rounded-full" : "aspect-[4/3] rounded-sm",
        styles,
        className,
      )}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span
        className={cn(
          "font-display text-[0.6rem] tracking-[0.3em] uppercase opacity-80",
          compact && "hidden sm:inline",
        )}
      >
        Solei
      </span>
      <span
        className={cn(
          "font-display leading-tight uppercase",
          compact
            ? "text-[0.5rem] tracking-[0.02em] sm:text-xs sm:tracking-[0.12em]"
            : "text-sm tracking-[0.12em]",
        )}
      >
        {label}
      </span>
      {sublabel ? (
        <span className="text-[0.55rem] tracking-[0.2em] uppercase opacity-70">{sublabel}</span>
      ) : null}
    </div>
  );
}
