"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
      className="relative isolate h-[100svh] min-h-[560px] overflow-hidden bg-[#2a0610]"
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
            {/* Phones: the landscape photo sits in the lower part and fades into the wall colour,
                so the product stays whole under the copy. */}
            <div className="absolute inset-x-0 top-[30%] bottom-0 sm:top-0">
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
                className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#2a0610] to-transparent sm:hidden"
              />
            </div>
            {/* Copy sits centred at the top over the wall; the product holds the lower half. */}
            <div
              aria-hidden
              className="from-noir/80 via-noir/25 absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b to-transparent"
            />
            <div
              aria-hidden
              className="from-noir/70 absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent"
            />

            <div className="relative z-10 mx-auto flex h-full max-w-[96rem] flex-col items-center px-6 pt-[clamp(7rem,17vh,10rem)] text-center sm:px-10">
              <p
                className={cn(
                  "eyebrow text-pearl/80 transition-all delay-300 duration-1000 ease-(--ease-soft)",
                  active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                )}
              >
                {slide.eyebrow}
              </p>
              {i === 0 ? (
                <h1 className="display text-pearl mt-5 text-[clamp(2.5rem,5.6vw,5rem)] leading-[1.02]">
                  <HeadlineLines lines={slide.title} active={active} />
                </h1>
              ) : (
                <h2 className="display text-pearl mt-5 text-[clamp(2.5rem,5.6vw,5rem)] leading-[1.02]">
                  <HeadlineLines lines={slide.title} active={active} />
                </h2>
              )}
              <Link
                href={slide.cta.href}
                tabIndex={active ? 0 : -1}
                aria-label={`${slide.cta.label} — ${slide.title.join(" ")}`}
                className={cn(
                  "group border-pearl/50 text-pearl hover:border-pink hover:bg-pink hover:text-burgundy relative mt-9 flex size-24 items-center justify-center rounded-full border text-[0.6rem] tracking-[0.28em] uppercase transition-all delay-500 duration-1000 ease-(--ease-soft) sm:size-28",
                  active ? "scale-100 opacity-100" : "scale-90 opacity-0",
                )}
              >
                {slide.cta.label}
              </Link>
            </div>
          </div>
        );
      })}

      <div aria-hidden className="film-grain pointer-events-none absolute inset-0 z-[15]" />

      {/* Counters, as in the brand layout: current slide bottom-start; next + progress +
          position bottom-end. Hover/focus pauses; the pause toggle appears on keyboard focus. */}
      <div
        className="text-pearl/75 absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[96rem] items-center justify-between gap-6 px-6 pb-7 text-[0.65rem] tracking-[0.3em] sm:px-10 lg:px-14"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
      >
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous slide"
          className="numeric hover:text-pink min-h-11 transition-colors"
        >
          {String(index + 1).padStart(2, "0")}
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause slideshow" : "Play slideshow"}
            className="sr-only focus:not-sr-only focus:px-2"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="numeric hover:text-pink min-h-11 transition-colors"
          >
            {String(((index + 1) % count) + 1).padStart(2, "0")}
          </button>
          <span aria-hidden className="bg-pearl/25 relative h-px w-16 overflow-hidden sm:w-24">
            <span
              key={`${index}-${playing && !hovering}`}
              className={cn(
                "bg-pearl absolute inset-y-0 start-0",
                playing && !hovering ? "animate-[solei-progress_7s_linear_forwards]" : "w-0",
              )}
            />
          </span>
          <span className="numeric">
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="text-pearl/45">/ {String(count).padStart(2, "0")}</span>
          </span>
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
