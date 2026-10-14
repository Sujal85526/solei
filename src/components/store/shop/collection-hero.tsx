import Image from "next/image";
import { SplitHeading } from "@/components/motion/split-heading";
import { CircleArrowLink } from "@/components/store/home/circle-arrow-link";

/**
 * Collection opener: the sprays among burgundy flowers in late light, copy on the dark wall to the
 * left with a link down to the grid; a compact banner on phones. The header floats over it.
 */
export function CollectionHero({ image, targetId }: { image: string; targetId: string }) {
  return (
    <section
      data-hero
      aria-labelledby="collection-title"
      className="bg-noir relative isolate flex min-h-[22rem] items-end overflow-hidden sm:min-h-[80svh] sm:items-center"
    >
      {/* Full-bleed photograph; the copy sits over the dark wall on the left (on phones the frame
          leans right so the sprays stay in view beside it). */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="hero-photo object-cover object-[100%_55%] sm:object-center"
        />
        <div className="from-noir/90 via-noir/45 sm:from-noir/70 sm:via-noir/20 absolute inset-0 bg-gradient-to-r to-transparent to-75% sm:to-55%" />
        <div className="from-noir/60 absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t to-transparent sm:h-32" />
      </div>
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-24 pb-9 sm:px-10 sm:pt-24 sm:pb-16 lg:px-14">
        <div className="sm:max-w-md">
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
            className="text-pearl mt-3 max-w-[13rem] text-[1.85rem] leading-[1.05] sm:mt-5 sm:max-w-none sm:text-6xl"
          />
          <div className="hero-rise mt-6 sm:mt-10" style={{ "--d": "0.5s" } as React.CSSProperties}>
            <CircleArrowLink href={`#${targetId}`} className="text-pearl whitespace-nowrap">
              Explore all fragrances
            </CircleArrowLink>
          </div>
        </div>
      </div>
    </section>
  );
}
