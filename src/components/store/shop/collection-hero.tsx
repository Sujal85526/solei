import Image from "next/image";
import { SplitHeading } from "@/components/motion/split-heading";
import { CircleArrowLink } from "@/components/store/home/circle-arrow-link";

/**
 * Collection opener: the sprays among burgundy flowers in late light, copy on the dark wall (left
 * on wide screens, top on phones) with a link down to the grid. The header floats over it.
 */
export function CollectionHero({ image, targetId }: { image: string; targetId: string }) {
  return (
    <section
      data-hero
      aria-labelledby="collection-title"
      className="bg-noir relative isolate flex min-h-[88svh] items-start overflow-hidden sm:min-h-[80svh] sm:items-center"
    >
      {/* Phones: the photo fills the lower part and fades up into the dark wall behind the copy;
          wide screens: full-bleed with the copy over the dark left side. */}
      <div className="absolute inset-x-0 top-[34%] bottom-0 -z-10 overflow-hidden sm:inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="hero-photo object-cover object-[78%_60%] sm:object-center"
        />
        <div className="from-noir absolute inset-x-0 -top-px h-1/2 bg-gradient-to-b to-transparent sm:hidden" />
        <div className="from-noir/70 via-noir/20 absolute inset-0 hidden bg-gradient-to-r to-transparent to-55% sm:block" />
        <div className="from-noir/60 absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t to-transparent" />
      </div>
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-28 pb-16 sm:px-10 sm:pt-24 lg:px-14">
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
