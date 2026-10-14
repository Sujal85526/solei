import Image from "next/image";
import Link from "next/link";
import { PostcardFrame } from "@/components/brand";
import type { StoreDestination } from "@/modules/storefront/types";

const tilts = [-1.5, 1, -0.5, 1.5, 1, -1.5, 0.5, -1];

/** Destination postcard — the same look as the homepage "Shop by destination" cards. */
export function DestinationPostcard({
  destination,
  index,
  showMood = true,
  priority = false,
}: {
  destination: StoreDestination;
  index: number;
  showMood?: boolean;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/destinations/${destination.slug}`}
      className="group block focus-visible:outline-none"
    >
      <PostcardFrame
        tilt={tilts[index % tilts.length]}
        className="group-focus-visible:ring-burgundy transition-transform duration-500 ease-(--ease-soft) group-hover:-translate-y-1 group-hover:!rotate-0 group-focus-visible:ring-2"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={destination.postcardImage}
            alt=""
            fill
            preload={priority}
            sizes="(min-width: 768px) 22vw, 45vw"
            className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col items-center gap-1 px-2 pt-3 pb-1.5 text-center">
          <h2 className="font-display text-lg tracking-[0.2em] uppercase sm:text-xl">
            {destination.name}
          </h2>
          <p className="text-ink-muted text-[0.7rem] tracking-[0.18em] uppercase">
            {destination.region}
          </p>
        </div>
      </PostcardFrame>
      {showMood && destination.mood ? (
        <p className="text-ink-muted mt-5 text-sm leading-relaxed">{destination.mood}</p>
      ) : null}
    </Link>
  );
}
