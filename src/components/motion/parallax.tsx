import type { CSSProperties, ReactNode } from "react";

export type ParallaxRange = {
  /** Vertical offset at the start of the range (CSS length; % is of the element's own height). */
  from: string;
  to: string;
  scale?: [number, number] | number;
  rotate?: [number, number];
};

/**
 * Scroll parallax as a CSS scroll-driven animation: compositor-only (transform), no scroll
 * listeners, zero JavaScript in browsers that support `animation-timeline` (ParallaxFallback covers
 * the rest). Off for prefers-reduced-motion.
 *
 * `timeline="view"` maps the range over the element crossing the viewport; `"page"` maps it over
 * the first viewport of page scroll (for the hero, which starts in view).
 */
export function Parallax({
  children,
  className,
  timeline = "view",
  ...range
}: ParallaxRange & {
  children: ReactNode;
  className?: string;
  timeline?: "view" | "page";
}) {
  return (
    <div data-parallax={timeline} className={className} style={parallaxStyle(range)}>
      {children}
    </div>
  );
}

export function parallaxStyle({ from, to, scale = 1, rotate }: ParallaxRange): CSSProperties {
  const [s0, s1] = typeof scale === "number" ? [scale, scale] : scale;
  return {
    "--parallax-from": from,
    "--parallax-to": to,
    "--parallax-scale-from": s0,
    "--parallax-scale-to": s1,
    ...(rotate
      ? { "--parallax-rotate-from": `${rotate[0]}deg`, "--parallax-rotate-to": `${rotate[1]}deg` }
      : {}),
  } as CSSProperties;
}
