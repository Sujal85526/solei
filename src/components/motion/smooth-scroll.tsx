"use client";

import { useEffect } from "react";

/**
 * Inertial smooth scrolling (Lenis) for the storefront on wheel/trackpad devices. Lenis drives the
 * native window scroll, so anchor links, Next.js navigation, scroll restoration and CSS scroll
 * timelines keep working. Skipped for prefers-reduced-motion and touch-first devices (native
 * momentum feels better there); loaded after hydration as its own small chunk.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 0.9 });
      destroy = () => lenis.destroy();
    });
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, []);
  return null;
}
