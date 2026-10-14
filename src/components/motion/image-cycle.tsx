"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type CycleImage = { src: string; alt: string; position?: string };

const INTERVAL_MS = 4500;

/**
 * Crossfading photo sequence with a slow drift on the visible frame. It only advances while on
 * screen and the tab is visible, and stays on the first photo for prefers-reduced-motion. Small
 * dots show progress and let people jump to a photo.
 */
export function ImageCycle({
  images,
  sizes,
  className,
}: {
  images: CycleImage[];
  sizes: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = images.length;

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || count < 2) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [visible, index, count]);

  return (
    <div ref={ref} className={cn("absolute inset-0", className)}>
      {images.map((img, i) => {
        const active = i === index;
        return (
          <div
            key={img.src}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1600ms] ease-(--ease-soft)",
              active ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes={sizes}
              className={cn(
                "object-cover transition-transform duration-[6000ms] ease-out motion-reduce:transition-none",
                active ? "scale-[1.08]" : "scale-100",
              )}
              style={{ objectPosition: img.position }}
            />
          </div>
        );
      })}
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2">
          {images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1} of ${count}`}
              aria-current={i === index}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={cn(
                  "block h-px transition-all duration-500",
                  i === index ? "bg-pearl w-6" : "bg-pearl/40 w-3",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
