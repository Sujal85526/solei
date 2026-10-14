"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import type { StoreImage } from "@/modules/storefront/types";

const smooth = () =>
  typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "smooth"
    : "auto";

/**
 * Product gallery: a scroll-snap strip (native swipe on touch devices) with thumbnails on larger
 * screens and dots on phones. Works without JS as a horizontally scrollable strip.
 */
export function ProductGallery({ images, name }: { images: StoreImage[]; name: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const many = images.length > 1;

  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    // Math.abs: scrollLeft is negative in RTL.
    setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  }, []);

  const go = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollTo({ left: dir * i * el.clientWidth, behavior: smooth() });
    setActive(i);
  };

  return (
    <div
      className="flex flex-col gap-4 md:flex-row-reverse md:gap-5"
      aria-label={t.product.gallery}
    >
      <div className="relative min-w-0 flex-1">
        <div
          ref={strip}
          onScroll={many ? onScroll : undefined}
          tabIndex={many ? 0 : undefined}
          aria-roledescription={many ? "carousel" : undefined}
          className="bg-sand flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className="relative aspect-[4/5] w-full shrink-0 snap-center"
              aria-roledescription={many ? "slide" : undefined}
              aria-label={many ? `${i + 1} / ${images.length}` : undefined}
            >
              <Image
                src={img.url}
                alt={img.alt || name}
                fill
                preload={i === 0}
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="outline-cream/60 pointer-events-none absolute inset-3 outline outline-1 sm:inset-4"
              />
            </div>
          ))}
        </div>
        {many ? (
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2 md:hidden">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={t.product.showImage(i + 1)}
                aria-current={i === active ? "true" : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-300",
                    i === active ? "bg-cream w-5" : "bg-cream/60 w-1.5",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {many ? (
        <ul className="hidden w-20 shrink-0 flex-col gap-3 md:flex lg:w-24">
          {images.map((img, i) => (
            <li key={`${img.url}-${i}`}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t.product.showImage(i + 1)}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "bg-sand relative block aspect-[4/5] w-full overflow-hidden transition-all duration-300",
                  i === active
                    ? "ring-burgundy ring-offset-cream ring-1 ring-offset-2"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
