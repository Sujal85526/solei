import Image, { getImageProps } from "next/image";
import Link from "next/link";
import type { HeroContent } from "@/content/home";
import type { Banner } from "@/modules/banners/schema";
import { BannerRotator, type RotatorSlide } from "./banner-rotator";

/** Desktop and phone pictures of one banner, as the srcSets the browser picks from. */
function rotatorSlide(b: Banner): RotatorSlide {
  const common = { alt: b.alt, sizes: "100vw", quality: 80 };
  const desktop = getImageProps({ ...common, src: b.desktopUrl, width: 2400, height: 1350 });
  const mobile = getImageProps({ ...common, src: b.mobileUrl, width: 1080, height: 1920 });
  return {
    id: b.id,
    alt: b.alt,
    href: b.href,
    seconds: b.seconds,
    desktopSrcSet: desktop.props.srcSet ?? "",
    mobileSrc: mobile.props.src,
    mobileSrcSet: mobile.props.srcSet ?? "",
  };
}

/**
 * Full-screen hero. With owner-uploaded banners (Admin → Settings → Homepage banners) it is those
 * pictures, rotating; otherwise the Cannes bottle with the copy centred above it. The section is
 * sticky, so the rest of the page slides up over it. Server-rendered; the entrance is CSS
 * (globals.css "Hero").
 */
export function Hero({ hero, banners = [] }: { hero: HeroContent; banners?: Banner[] }) {
  if (banners.length) {
    return (
      <section
        data-hero
        aria-label="Featured"
        className="sticky top-0 isolate h-[100svh] min-h-[560px] overflow-hidden bg-[#2a0610]"
      >
        <h1 className="sr-only">Solei — {hero.title.join(" ")}</h1>
        <BannerRotator slides={banners.map(rotatorSlide)} />
        {/* Keeps the white header readable over any picture. */}
        <div
          aria-hidden
          className="from-noir/60 pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b to-transparent"
        />
      </section>
    );
  }
  return (
    <section
      data-hero
      aria-labelledby="hero-title"
      className="sticky top-0 isolate h-[100svh] min-h-[560px] overflow-hidden bg-[#2a0610]"
    >
      {/* Phones: the landscape photo sits in the lower part and fades into the wall colour, so the
          bottle stays whole under the copy. */}
      <div className="absolute inset-x-0 top-[30%] bottom-0 overflow-hidden sm:top-0">
        <Image
          src={hero.image}
          alt={hero.alt}
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="hero-photo object-cover"
          style={{ objectPosition: hero.focus }}
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
        <p
          className="hero-rise eyebrow text-pearl/80"
          style={{ "--d": "0.3s" } as React.CSSProperties}
        >
          {hero.eyebrow}
        </p>
        <h1
          id="hero-title"
          className="display text-pearl mt-4 text-[clamp(2.1rem,5.6vw,5rem)] leading-[1.02] sm:mt-5"
        >
          {hero.title.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <span
                className={`hero-line block ${i === 1 ? "italic" : ""}`}
                style={{ "--d": `${0.15 + i * 0.12}s` } as React.CSSProperties}
              >
                {line}
              </span>
            </span>
          ))}
        </h1>
        <Link
          href={hero.cta.href}
          className="hero-rise border-pearl/50 text-pearl hover:border-pink hover:bg-pink hover:text-burgundy mt-8 flex size-20 items-center justify-center rounded-full border text-[0.55rem] tracking-[0.28em] uppercase transition-colors duration-300 sm:mt-9 sm:size-28 sm:text-[0.6rem]"
          style={{ "--d": "0.5s" } as React.CSSProperties}
        >
          {hero.cta.label}
        </Link>
      </div>
    </section>
  );
}
