import Image from "next/image";
import { SplitHeading } from "@/components/motion/split-heading";
import { CircleArrowLink } from "@/components/store/home/circle-arrow-link";

/**
 * Collection opener: the all-over sprays toned into burgundy, copy on the left with a link down to
 * the grid. The header floats over it (data-hero).
 */
export function CollectionHero({ image, targetId }: { image: string; targetId: string }) {
  return (
    <section
      data-hero
      aria-labelledby="collection-title"
      className="bg-noir relative isolate flex min-h-[78svh] items-center overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 sm:start-[30%]">
        <Image
          src={image}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="(min-width: 640px) 70vw, 100vw"
          className="hero-photo object-cover object-[40%_50%]"
        />
        {/* Tone the warm-cream photograph into the burgundy night of the brand. */}
        <div className="bg-burgundy absolute inset-0 opacity-60 mix-blend-multiply" />
        <div className="from-noir via-noir/40 absolute inset-0 bg-gradient-to-t to-transparent sm:bg-gradient-to-r sm:to-transparent sm:to-60%" />
      </div>
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-28 pb-16 sm:px-10 lg:px-14">
        <div className="max-w-md">
          <p
            className="hero-rise eyebrow text-pearl/75"
            style={{ "--d": "0.1s" } as React.CSSProperties}
          >
            The collection
          </p>
          <SplitHeading
            as="h1"
            id="collection-title"
            lines={["Scents for every", "destination."]}
            italic={[]}
            className="text-pearl mt-5 text-4xl leading-[1.05] sm:text-6xl"
          />
          <div className="hero-rise mt-10" style={{ "--d": "0.5s" } as React.CSSProperties}>
            <CircleArrowLink href={`#${targetId}`} className="text-pearl">
              Explore all fragrances
            </CircleArrowLink>
          </div>
        </div>
      </div>
    </section>
  );
}
