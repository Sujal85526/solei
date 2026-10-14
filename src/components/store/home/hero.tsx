import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArchPalm, Eyebrow, Logo, PostmarkWaves } from "@/components/brand";
import { Parallax } from "@/components/motion/parallax";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/content/en";

/** Entrance delay (s) for a `.hero-rise` / `.hero-line` element; offset by the intro loader in CSS. */
const d = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-burgundy text-cream relative isolate overflow-hidden"
    >
      <div className="mx-auto grid max-w-[90rem] lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-12">
        {/* Photography — first on mobile, right on desktop. Drifts slower than the page. */}
        <div className="relative aspect-[4/3.4] overflow-hidden sm:aspect-[16/10] lg:order-2 lg:col-span-7 lg:aspect-auto">
          <Parallax
            timeline="page"
            from="0%"
            to="14%"
            scale={[1.04, 1.1]}
            className="absolute inset-0"
          >
            {/* The LCP image: plain next/image, no fade, so it paints as early as possible. */}
            <Image
              src="/images/brand/hero-sprays-arch.jpg"
              alt="Three Solei all-over sprays in blush pink with gold bands, beside an arch with a palm"
              fill
              preload
              fetchPriority="high"
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-[60%_center]"
            />
          </Parallax>
          <div
            aria-hidden
            className="from-burgundy via-burgundy/10 lg:from-burgundy absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r lg:via-transparent"
          />
        </div>

        {/* Copy */}
        <div className="relative flex flex-col justify-center gap-7 px-5 pt-2 pb-16 sm:px-10 lg:col-span-5 lg:px-14 lg:py-20">
          <Parallax
            timeline="page"
            from="0px"
            to="-80px"
            className="pointer-events-none absolute -end-6 bottom-6 hidden lg:block"
          >
            <ArchPalm className="text-pink/15 h-72" />
          </Parallax>
          <Eyebrow className="hero-rise text-pink/90" style={d(0.05)}>
            {t.brand.promise}
          </Eyebrow>
          <div className="hero-rise self-start" style={d(0.12)}>
            <Logo className="text-pink h-16 sm:h-20 lg:h-24" title="Solei" />
          </div>
          <h1
            id="hero-title"
            className="text-cream max-w-md text-4xl leading-[1.05] sm:text-5xl lg:text-[3.5rem]"
          >
            <span className="-mb-[0.15em] block overflow-hidden pb-[0.15em]">
              <span className="hero-line block" style={d(0.22)}>
                A destination
              </span>
            </span>{" "}
            <span className="-mb-[0.15em] block overflow-hidden pb-[0.15em]">
              <span className="hero-line block italic" style={d(0.34)}>
                in scent.
              </span>
            </span>
          </h1>
          <p className="hero-rise text-cream/85 max-w-sm text-base leading-relaxed" style={d(0.5)}>
            Perfumes and all-over sprays, each inspired by a place worth remembering — from Cannes
            to Capri, Soho to Santorini.
          </p>
          <div className="hero-rise flex flex-col gap-3 sm:flex-row" style={d(0.6)}>
            <Link href="/shop" className={buttonVariants({ size: "cta", variant: "secondary" })}>
              Shop the collection
            </Link>
            <Link
              href="/events"
              className={buttonVariants({ size: "cta", variant: "outline-light" })}
            >
              Plan your event
            </Link>
          </div>
          <div className="hero-rise flex items-center gap-4 pt-2" style={d(0.7)}>
            <PostmarkWaves className="text-pink/50 w-24" lines={3} />
            <p className="font-display text-pink text-lg italic">{t.brand.tagline}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
