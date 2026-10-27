import Image from "next/image";
import Link from "next/link";
import type { HeroContent } from "@/content/home";

/**
 * Full-screen hero. One slide (today: the Cannes bottle) or a slideshow that crossfades between
 * several — a slide with `showOverlayText` gets the site's eyebrow/title/CTA typography on top,
 * full-bleed (object-cover); one without (e.g. an event poster with its own baked-in text) is
 * shown whole (object-contain) on wider screens, backed by a blurred fill of the same photo so
 * there's no empty bar — on phones it already fills the frame, so it stays full-bleed there too.
 * The section is sticky, so the rest of the page slides up over it. Server-rendered; all entrance
 * and slideshow motion is CSS only (globals.css "Hero").
 */
export function Hero({ slides }: { slides: HeroContent[] }) {
  const cycle = 14; // seconds per full loop — only matters once there's more than one slide
  return (
    <section
      data-hero
      aria-labelledby="hero-title"
      className="sticky top-0 isolate h-[100svh] min-h-[560px] overflow-hidden bg-[#2a0610]"
    >
      {slides.map((slide, i) =>
        slide.showOverlayText ? (
          <PhotoSlide key={slide.image} slide={slide} index={i} slideCount={slides.length} cycle={cycle} />
        ) : (
          <PosterSlide key={slide.image} slide={slide} index={i} slideCount={slides.length} cycle={cycle} />
        ),
      )}
    </section>
  );
}

function slideStyle(index: number, slideCount: number, cycle: number) {
  return slideCount > 1
    ? ({ "--slide-delay": `${-(index * cycle) / slideCount}s` } as React.CSSProperties)
    : undefined;
}

/** A brand photo, full-bleed, with the site's own eyebrow/title/CTA overlaid on top. */
function PhotoSlide({
  slide,
  index,
  slideCount,
  cycle,
}: {
  slide: HeroContent;
  index: number;
  slideCount: number;
  cycle: number;
}) {
  return (
    <div
      className={slideCount > 1 ? "hero-slide absolute inset-0" : "absolute inset-0"}
      style={slideStyle(index, slideCount, cycle)}
    >
      {/* Phones: the landscape photo sits in the lower part and fades into the wall colour, so the
          subject stays whole under the copy. */}
      <div className="absolute inset-x-0 top-[30%] bottom-0 overflow-hidden sm:top-0">
        <Image
          src={slide.image}
          alt={slide.alt}
          fill
          priority={index === 0}
          fetchPriority={index === 0 ? "high" : undefined}
          sizes="100vw"
          className="hero-photo object-cover"
          style={{ objectPosition: slide.focus }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 -top-px h-2/5 bg-gradient-to-b from-[#2a0610] via-[#2a0610]/60 to-transparent sm:hidden"
        />
      </div>
      <div
        aria-hidden
        className="from-noir/80 via-noir/25 absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b to-transparent"
      />

      <div className="relative mx-auto flex h-full max-w-[96rem] flex-col items-center px-6 pt-[clamp(6.5rem,16vh,9.5rem)] text-center sm:px-10">
        <p className="hero-rise eyebrow text-pearl/80" style={{ "--d": "0.3s" } as React.CSSProperties}>
          {slide.eyebrow}
        </p>
        <h1
          id="hero-title"
          className="display text-pearl mt-4 text-[clamp(2.1rem,5.6vw,5rem)] leading-[1.02] sm:mt-5"
        >
          {slide.title?.map((line, j) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <span
                className={`hero-line block ${j === 1 ? "italic" : ""}`}
                style={{ "--d": `${0.15 + j * 0.12}s` } as React.CSSProperties}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>
        {slide.cta ? (
          <Link
            href={slide.cta.href}
            className="hero-rise border-pearl/50 text-pearl hover:border-pink hover:bg-pink hover:text-burgundy mt-8 flex size-20 items-center justify-center rounded-full border text-[0.55rem] tracking-[0.28em] uppercase transition-colors duration-300 sm:mt-9 sm:size-28 sm:text-[0.6rem]"
            style={{ "--d": "0.5s" } as React.CSSProperties}
          >
            {slide.cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** A poster with its own text (e.g. an event announcement): shown whole, never cropped, on
 *  screens wider than it is tall — a blurred fill of the same photo stands in for empty bars.
 *  On phones (already close to its own aspect ratio) it stays full-bleed like any other slide. */
function PosterSlide({
  slide,
  index,
  slideCount,
  cycle,
}: {
  slide: HeroContent;
  index: number;
  slideCount: number;
  cycle: number;
}) {
  return (
    <div
      className={slideCount > 1 ? "hero-slide absolute inset-0" : "absolute inset-0"}
      style={slideStyle(index, slideCount, cycle)}
    >
      <Image
        aria-hidden
        src={slide.image}
        alt=""
        fill
        sizes="100vw"
        className="hero-photo hidden scale-110 object-cover opacity-70 blur-2xl sm:block"
        style={{ objectPosition: slide.focus }}
      />
      <Image
        src={slide.image}
        alt={slide.alt}
        fill
        priority={index === 0}
        fetchPriority={index === 0 ? "high" : undefined}
        sizes="100vw"
        className="hero-photo object-cover sm:object-contain"
        style={{ objectPosition: slide.focus }}
      />
    </div>
  );
}
