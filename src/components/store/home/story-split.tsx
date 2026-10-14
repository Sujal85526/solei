import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";

/** Photo + blush panel: "Our story — A world in every scent." */
export function StorySplit({ image }: { image: string }) {
  return (
    <section aria-labelledby="story-title" id="story" className="grid lg:grid-cols-2">
      <div className="bg-noir relative aspect-[4/5] overflow-hidden sm:aspect-[16/11] lg:aspect-auto lg:min-h-[44rem]">
        <Parallax from="-6%" to="6%" scale={1.12} className="absolute inset-0">
          <ShimmerImage
            src={image}
            alt="A woman in warm light holding a Solei all-over spray"
            fill
            tone="dark"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </Parallax>
      </div>
      <div className="on-blush flex items-center px-6 py-20 sm:px-14 lg:px-20">
        <Reveal className="max-w-md">
          <p className="eyebrow text-burgundy/70">Our story</p>
          <h2 id="story-title" className="display mt-5 text-5xl sm:text-6xl">
            A world <span className="block italic">in every scent.</span>
          </h2>
          <span aria-hidden className="bg-burgundy/40 mt-8 block h-px w-12" />
          <p className="text-ink/80 mt-8 text-[0.95rem] leading-relaxed">
            Solei was created to make fragrance feel more personal, meaningful and memorable.
            Inspired by travel, each scent captures the essence of a destination and turns it into
            an experience — a little piece of somewhere that stays with you.
          </p>
          <Link
            href="/destinations"
            className="group border-burgundy/60 text-burgundy hover:bg-burgundy hover:text-pink mt-10 inline-flex h-12 items-center gap-4 border px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
          >
            Discover our story
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
              strokeWidth={1.25}
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
