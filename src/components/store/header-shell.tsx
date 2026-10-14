"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Over the home hero the header is transparent and floats; once the page scrolls (or on any other
 * page) it becomes a solid wine-black bar. Scroll state is read with a passive listener + rAF.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const overlay = usePathname() === "/";
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

  const solid = !overlay || scrolled;
  return (
    <header
      data-solid={solid || undefined}
      className={cn(
        "text-pearl inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-500 ease-(--ease-soft)",
        overlay ? "fixed" : "sticky",
        solid
          ? "border-pink/10 bg-noir/85 supports-[backdrop-filter]:bg-noir/70 border-b backdrop-blur-md"
          : "from-noir/50 border-b border-transparent bg-gradient-to-b to-transparent",
      )}
    >
      {children}
    </header>
  );
}
