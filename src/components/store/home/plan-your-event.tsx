import { CinematicImage } from "@/components/motion/cinematic-image";
import { SoonTag } from "@/components/store/soon-tag";
import { eventsCopy } from "@/content/events";
import { FEATURES } from "@/lib/features";
import { CircleArrowLink } from "./circle-arrow-link";
import { MediaSplit } from "./media-split";
import { SectionCopy } from "./section-copy";

/**
 * "Plan your event" — its own homepage band, so bookings are visible without the menu. While the
 * feature is locked (FEATURES.bookings off) it says "Coming soon" and links to the shop instead.
 */
export function PlanYourEvent({ image }: { image: string }) {
  const c = eventsCopy.home;
  const open = FEATURES.bookings;
  return (
    <MediaSplit
      id="plan-your-event"
      labelledBy="plan-your-event-title"
      mediaSide="end"
      media={
        <CinematicImage
          src={image}
          alt={c.imageAlt}
          sizes="(min-width: 1024px) 58vw, 100vw"
          position="50% 55%"
        />
      }
    >
      <SectionCopy
        id="plan-your-event-title"
        eyebrow={c.eyebrow}
        title={[...c.title]}
        action={
          open ? (
            <CircleArrowLink href="/events">{c.cta}</CircleArrowLink>
          ) : (
            <CircleArrowLink href="/shop">{c.soonCta}</CircleArrowLink>
          )
        }
      >
        {open ? (
          c.lede
        ) : (
          <>
            {c.soonLede}
            <SoonTag className="ms-2" />
          </>
        )}
      </SectionCopy>
    </MediaSplit>
  );
}
