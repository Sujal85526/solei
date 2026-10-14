import Link from "next/link";
import type { HeroSlide } from "@/content/home";
import { cn } from "@/lib/utils";

const enter = "transition-all duration-1000 ease-(--ease-soft)";

/** One slide's copy: eyebrow, two-line headline (masked rise) and the round call to action. */
export function HeroCopy({
  slide,
  active,
  primary,
  index,
  count,
}: {
  slide: HeroSlide;
  active: boolean;
  /** The first slide's headline is the page's h1. */
  primary: boolean;
  index: number;
  count: number;
}) {
  const Heading = primary ? "h1" : "h2";
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      aria-hidden={!active}
      className={cn(
        "absolute inset-0 mx-auto flex max-w-[96rem] flex-col items-center px-6 pt-[clamp(6.5rem,16vh,9.5rem)] text-center sm:px-10",
        active ? "z-10" : "pointer-events-none z-0",
      )}
    >
      <p
        className={cn(
          "eyebrow text-pearl/80 delay-300",
          enter,
          active ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        {slide.eyebrow}
      </p>
      <Heading className="display text-pearl mt-4 text-[clamp(2.1rem,5.6vw,5rem)] leading-[1.02] sm:mt-5">
        {slide.title.map((line, i) => (
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
      </Heading>
      <Link
        href={slide.cta.href}
        tabIndex={active ? 0 : -1}
        aria-label={`${slide.cta.label} — ${slide.title.join(" ")}`}
        className={cn(
          "border-pearl/50 text-pearl hover:border-pink hover:bg-pink hover:text-burgundy mt-8 flex size-20 items-center justify-center rounded-full border text-[0.55rem] tracking-[0.28em] uppercase delay-500 sm:mt-9 sm:size-28 sm:text-[0.6rem]",
          enter,
          active ? "scale-100 opacity-100" : "scale-90 opacity-0",
        )}
      >
        {slide.cta.label}
      </Link>
    </div>
  );
}
