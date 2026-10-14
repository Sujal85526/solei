"use client";

import type { HeroSlide } from "@/content/home";
import { HeroBackdrop } from "./hero/hero-backdrop";
import { HeroCopy } from "./hero/hero-copy";
import { HeroCounters } from "./hero/hero-counters";
import { useSlideshow } from "./hero/use-slideshow";

const INTERVAL_MS = 7000;

/**
 * Full-screen hero: photographs fixed behind the page (crossfade + slow drift), the copy and
 * counters scrolling away over them. Composition only — state lives in useSlideshow.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const show = useSlideshow(slides.length, INTERVAL_MS);
  return (
    <section
      data-hero
      aria-roledescription="carousel"
      aria-label="Solei"
      className="relative h-[100svh] min-h-[560px]"
    >
      <HeroBackdrop slides={slides} index={show.index} />
      <div className="relative z-10 h-full">
        {slides.map((slide, i) => (
          <HeroCopy
            key={slide.image}
            slide={slide}
            active={i === show.index}
            primary={i === 0}
            index={i}
            count={slides.length}
          />
        ))}
        <HeroCounters show={show} intervalMs={INTERVAL_MS} />
      </div>
    </section>
  );
}
