"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Over a page hero (`[data-hero]`, e.g. the home slider) the header floats transparently; once the
 * page scrolls — or on pages without a hero — it is a solid wine-black bar. Hero detection is pure
 * CSS (`:has()` in globals.css), so no URL access is needed during prerendering.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 24);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="site-header text-pearl inset-x-0 top-0 z-40"
    >
      {children}
    </header>
  );
}
