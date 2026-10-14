import Image from "next/image";
import Link from "next/link";
import { ArchPalm, Eyebrow, Logo, PostmarkWaves } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/content/en";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="bg-burgundy text-cream relative isolate overflow-hidden"
    >
      <div className="mx-auto grid max-w-[90rem] lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-12">
        {/* Photography — first on mobile, right on desktop */}
        <div className="relative aspect-[4/3.4] sm:aspect-[16/10] lg:order-2 lg:col-span-7 lg:aspect-auto">
          <Image
            src="/images/brand/hero-sprays-arch.jpg"
            alt="Three Solei all-over sprays in blush pink with gold bands, beside an arch with a palm"
            fill
            preload
            fetchPriority="high"
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover object-[60%_center]"
          />
          <div
            aria-hidden
            className="from-burgundy via-burgundy/10 lg:from-burgundy absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r lg:via-transparent"
          />
        </div>

        {/* Copy */}
        <div className="relative flex flex-col justify-center gap-7 px-5 pt-2 pb-16 sm:px-10 lg:col-span-5 lg:px-14 lg:py-20">
          <ArchPalm className="text-pink/15 pointer-events-none absolute -end-6 bottom-6 hidden h-72 lg:block" />
          <Eyebrow className="text-pink/90">{t.brand.promise}</Eyebrow>
          <Logo className="text-pink h-16 self-start sm:h-20 lg:h-24" title="Solei" />
          <h1
            id="hero-title"
            className="text-cream max-w-md text-4xl leading-[1.05] sm:text-5xl lg:text-[3.5rem]"
          >
            A destination <span className="italic">in scent.</span>
          </h1>
          <p className="text-cream/85 max-w-sm text-base leading-relaxed">
            Perfumes and all-over sprays, each inspired by a place worth remembering — from Cannes
            to Capri, Soho to Santorini.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
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
          <div className="flex items-center gap-4 pt-2">
            <PostmarkWaves className="text-pink/50 w-24" lines={3} />
            <p className="font-display text-pink text-lg italic">{t.brand.tagline}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
