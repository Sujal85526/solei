import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";

/** "Our philosophy — Scents are memories in another form." Inset portrait on blush. */
export function StorySplit({ image }: { image: string }) {
  return (
    <section aria-labelledby="story-title" id="story" className="on-blush">
      <div className="mx-auto grid max-w-[96rem] items-center gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-12 lg:gap-20 lg:px-14">
        <div className="bg-noir relative aspect-[4/5] overflow-hidden sm:aspect-square lg:col-span-6">
          <Reveal data-curtain="" className="absolute inset-0">
            <Parallax from="-6%" to="6%" scale={1.12} className="absolute inset-0">
              <ShimmerImage
                src={image}
                alt="A woman in warm light holding a Solei all-over spray"
                fill
                tone="dark"
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </Parallax>
          </Reveal>
        </div>
        <Reveal className="max-w-md lg:col-span-5 lg:col-start-8">
          <p className="eyebrow text-burgundy/70">Our philosophy</p>
          <h2 id="story-title" className="display mt-5 text-5xl leading-[1.05] sm:text-6xl">
            Scents are memories <span className="block italic">in another form.</span>
          </h2>
          <span aria-hidden className="bg-burgundy/40 mt-8 block h-px w-12" />
          <p className="text-ink/80 mt-8 text-[0.95rem] leading-relaxed">
            Inspired by travel, every Solei fragrance captures the atmosphere, emotion and essence
            of a destination — turning it into an experience you can make your own.
          </p>
          <Link
            href="/destinations"
            className="group text-burgundy mt-10 inline-flex items-center gap-5 text-[0.65rem] tracking-[0.3em] uppercase"
          >
            <span className="border-burgundy/40 group-hover:border-burgundy border-b pb-1">
              Our story
            </span>
            <span className="border-burgundy/40 group-hover:bg-burgundy group-hover:text-pink flex size-11 items-center justify-center rounded-full border transition-colors">
              <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.25} />
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
