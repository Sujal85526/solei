"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import type { HeroSlide } from "@/content/home";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 7000;

/**
 * Full-bleed cinematic hero: crossfading slides with a slow Ken Burns drift, a counter, a progress
 * hairline, pause/play and arrows. Autoplay is off for prefers-reduced-motion and pauses while the
 * tab is hidden or the user hovers/focuses the controls.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const reduced = useRef(false);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing || hovering) return;
    const id = window.setTimeout(() => {
      if (!document.hidden) go(index + 1);
    }, INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, playing, hovering, go]);

  return (
    <section
      data-hero
      aria-roledescription="carousel"
      aria-label="Solei"
      className="bg-noir relative isolate h-[100svh] min-h-[560px] overflow-hidden"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.image + i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-(--ease-soft)",
              active ? "z-10 opacity-100" : "z-0 opacity-0",
            )}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "auto"}
              sizes="100vw"
              className={cn(
                "object-cover transition-transform duration-[9000ms] ease-out motion-reduce:transition-none",
                active ? "scale-100" : "scale-[1.08]",
              )}
              style={{ objectPosition: slide.focus }}
            />
            <div
              aria-hidden
              className="from-noir/80 via-noir/35 absolute inset-0 bg-gradient-to-r to-transparent"
            />
            <div
              aria-hidden
              className="from-noir/80 absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t to-transparent"
            />

            <div className="relative z-10 mx-auto flex h-full max-w-[96rem] flex-col justify-center px-6 pt-16 sm:px-10 lg:px-14">
              <div className="max-w-xl">
                <p
                  className={cn(
                    "eyebrow text-pink/80 transition-all delay-300 duration-1000 ease-(--ease-soft)",
                    active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  )}
                >
                  {slide.eyebrow}
                </p>
                {i === 0 ? (
                  <h1 className="display mt-6 text-[clamp(2.75rem,7vw,5.75rem)]">
                    <HeadlineLines lines={slide.title} active={active} />
                  </h1>
                ) : (
                  <h2 className="display mt-6 text-[clamp(2.75rem,7vw,5.75rem)]">
                    <HeadlineLines lines={slide.title} active={active} />
                  </h2>
                )}
                <Link
                  href={slide.cta.href}
                  tabIndex={active ? 0 : -1}
                  className={cn(
                    "group border-pink/50 text-pink hover:bg-pink hover:text-burgundy mt-10 inline-flex h-12 items-center gap-4 border px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-all delay-500 duration-1000 ease-(--ease-soft)",
                    active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  )}
                >
                  {slide.cta.label}
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                    strokeWidth={1.25}
                  />
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      {/* Controls */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[96rem] items-end justify-between gap-6 px-6 pb-8 sm:px-10 lg:px-14"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
      >
        <div className="text-pearl/80 flex items-center gap-4">
          <span className="numeric text-[0.7rem] tracking-[0.25em]">
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="text-pearl/40">/ {String(count).padStart(2, "0")}</span>
          </span>
          <span
            aria-hidden
            className="bg-pearl/20 relative hidden h-px w-24 overflow-hidden sm:block"
          >
            <span
              key={`${index}-${playing && !hovering}`}
              className={cn(
                "bg-pink absolute inset-y-0 start-0",
                playing && !hovering ? "animate-[solei-progress_7s_linear_forwards]" : "w-0",
              )}
            />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            className="border-pearl/30 text-pearl hover:border-pink hover:text-pink flex size-11 items-center justify-center rounded-full border transition-colors"
          >
            {playing ? (
              <Pause className="size-3.5" strokeWidth={1.25} />
            ) : (
              <Play className="size-3.5" strokeWidth={1.25} />
            )}
          </button>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="text-pearl hover:text-pink flex size-11 items-center justify-center transition-colors"
          >
            <ArrowLeft className="size-5 rtl:rotate-180" strokeWidth={1} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="text-pearl hover:text-pink flex size-11 items-center justify-center transition-colors"
          >
            <ArrowRight className="size-5 rtl:rotate-180" strokeWidth={1} />
          </button>
        </div>
      </div>
    </section>
  );
}

function HeadlineLines({ lines, active }: { lines: [string, string]; active: boolean }) {
  return (
    <>
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <span
            className={cn(
              "block transition-transform duration-[1200ms] ease-(--ease-soft) motion-reduce:transition-none",
              i === 1 && "italic",
              active ? "translate-y-0" : "translate-y-[110%]",
            )}
            style={{ transitionDelay: active ? `${150 + i * 120}ms` : "0ms" }}
          >
            {line}
          </span>
        </span>
      ))}
    </>
  );
}
