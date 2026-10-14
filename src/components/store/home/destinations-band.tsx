import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";

/** "Different places. Same feeling." — cinematic band. */
export function DestinationsBand({ image }: { image: string }) {
  return (
    <section
      aria-labelledby="destinations-title"
      className="bg-noir relative isolate overflow-hidden"
    >
      <div className="grid lg:grid-cols-12">
        <div className="relative z-10 flex flex-col justify-center px-6 py-20 sm:px-10 lg:col-span-5 lg:px-14 lg:py-28">
          <Reveal>
            <p className="eyebrow text-pink/70">The destinations</p>
            <h2 id="destinations-title" className="display mt-5 text-5xl sm:text-6xl lg:text-7xl">
              Different places.
              <span className="block italic">Same feeling.</span>
            </h2>
            <Link
              href="/destinations"
              className="group text-pearl/85 hover:text-pink mt-10 inline-flex items-center gap-5 text-[0.65rem] tracking-[0.3em] uppercase"
            >
              <span className="border-pink/30 group-hover:border-pink border-b pb-1">Explore</span>
              <span className="border-pink/40 group-hover:border-pink flex size-11 items-center justify-center rounded-full border transition-colors">
                <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.25} />
              </span>
            </Link>
          </Reveal>
        </div>
        <div className="relative aspect-[16/11] overflow-hidden lg:col-span-7 lg:aspect-auto lg:min-h-[40rem]">
          <Reveal data-curtain="" delay={150} className="absolute inset-0">
            <Parallax from="-8%" to="8%" scale={1.15} className="absolute inset-0">
              <ShimmerImage
                src={image}
                alt="Sunset over a rocky coastline seen from a room with billowing linen curtains"
                fill
                tone="dark"
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            </Parallax>
          </Reveal>
          <div
            aria-hidden
            className="from-noir via-noir/20 absolute inset-0 bg-gradient-to-r to-transparent lg:via-transparent"
          />
        </div>
      </div>
    </section>
  );
}
