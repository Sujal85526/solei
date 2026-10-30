"use client";

import { useEffect, useState } from "react";

export type RotatorSlide = {
  id: string;
  seconds: number;
  desktopSrcSet: string;
  mobileSrc: string;
  mobileSrcSet: string;
};

/**
 * The owner's homepage banners (Admin → Settings → Homepage banners): one at a time, each fading
 * into the next after its own number of seconds. A single banner just stays. Visitors who ask for
 * reduced motion get no automatic changes — the dots still switch banners.
 */
export function BannerRotator({ slides }: { slides: RotatorSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const many = slides.length > 1;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!many || paused || reduceMotion) return;
    const timer = setTimeout(
      () => setCurrent((n) => (n + 1) % slides.length),
      slides[current].seconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [many, paused, reduceMotion, current, slides]);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => {
        const active = i === current;
        const picture = (
          <picture>
            <source media="(min-width: 640px)" srcSet={s.desktopSrcSet} sizes="100vw" />
            <img
              src={s.mobileSrc}
              srcSet={s.mobileSrcSet}
              sizes="100vw"
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
          </picture>
        );
        return (
          <div
            key={s.id}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
              active ? "z-10 opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {picture}
          </div>
        );
      })}

      {many ? (
        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-2.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show banner ${i + 1} of ${slides.length}`}
              aria-current={i === current}
              onClick={() => setCurrent(i)}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={`block size-2 rounded-full border border-white/80 transition-colors ${
                  i === current ? "bg-white" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
