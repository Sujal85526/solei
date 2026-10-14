"use client";

import { useEffect } from "react";

/**
 * JS parallax for browsers without CSS scroll-driven animations (e.g. Firefox today). Mount once
 * per page that uses <Parallax>. Where `animation-timeline` is supported — or the user prefers
 * reduced motion — it does nothing and framer-motion is never downloaded.
 *
 * Uses framer-motion's `scroll()`: offsets are measured once (and on resize) and the callback only
 * writes `transform`, so scrolling never forces layout.
 */
export function ParallaxFallback() {
  useEffect(() => {
    if (CSS.supports("animation-timeline: view()")) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    const stops: VoidFunction[] = [];
    import("framer-motion/dom").then(({ scroll }) => {
      if (cancelled) return;
      for (const el of document.querySelectorAll<HTMLElement>("[data-parallax]")) {
        const v = (name: string, fallback: string) =>
          el.style.getPropertyValue(`--parallax-${name}`) || fallback;
        const [from, to] = [v("from", "0px"), v("to", "0px")];
        const [s0, s1] = [Number(v("scale-from", "1")), Number(v("scale-to", "1"))];
        const [r0, r1] = [parseFloat(v("rotate-from", "0")), parseFloat(v("rotate-to", "0"))];
        const page = el.dataset.parallax === "page";
        stops.push(
          scroll(
            (p: number) => {
              el.style.transform = `translate3d(0, calc(${from} + (${to} - ${from}) * ${p}), 0) scale(${
                s0 + (s1 - s0) * p
              }) rotate(${r0 + (r1 - r0) * p}deg)`;
            },
            {
              target: el,
              offset: page ? ["start start", "end start"] : ["start end", "end start"],
            },
          ),
        );
      }
    });
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
    };
  }, []);
  return null;
}
