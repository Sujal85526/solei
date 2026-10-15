import { CinematicImage } from "@/components/motion/cinematic-image";
import { CircleArrowLink } from "./circle-arrow-link";
import { MediaSplit } from "./media-split";
import { SectionCopy } from "./section-copy";

/** "Different places. Same feeling." — copy on the dark band, the window photo bleeding off the end. */
export function DestinationsBand({ image }: { image: string }) {
  return (
    <MediaSplit
      labelledBy="destinations-title"
      mediaSide="end"
      media={
        <>
          <CinematicImage
            src={image}
            alt="Sunset over a rocky coastline seen from a room with billowing linen curtains"
            sizes="(min-width: 1024px) 58vw, 100vw"
            drift="8%"
          />
          <div
            aria-hidden
            className="from-noir pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent to-40% lg:bg-gradient-to-r lg:to-25% rtl:lg:bg-gradient-to-l"
          />
        </>
      }
    >
      <SectionCopy
        id="destinations-title"
        eyebrow="The destinations"
        title={["Different places.", "Same feeling."]}
        action={<CircleArrowLink href="/shop">Explore</CircleArrowLink>}
      />
    </MediaSplit>
  );
}
