"use client";

import { useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Horizontal scroll-snap rail with arrow buttons (swipe on touch, arrows on desktop). */
export function CarouselRail({
  children,
  label,
  tone = "dark",
}: {
  children: ReactNode;
  label: string;
  tone?: "dark" | "blush";
}) {
  const btn =
    tone === "blush"
      ? "border-burgundy/30 text-burgundy hover:border-burgundy"
      : "border-pink/30 text-pink hover:border-pink";
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollBy({ left: dir * rtl * el.clientWidth * 0.8, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="-mx-6 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto scroll-smooth px-6 pb-2 sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        data-lenis-prevent
      >
        {children}
      </div>
      <div className="mt-8 hidden justify-end gap-2 lg:flex">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Previous"
          className={`${btn} flex size-11 items-center justify-center rounded-full border transition-colors`}
        >
          <ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.25} />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Next"
          className={`${btn} flex size-11 items-center justify-center rounded-full border transition-colors`}
        >
          <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.25} />
        </button>
      </div>
    </div>
  );
}
