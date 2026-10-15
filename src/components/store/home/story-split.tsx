import { CinematicImage } from "@/components/motion/cinematic-image";
import { CircleArrowLink } from "./circle-arrow-link";
import { MediaSplit } from "./media-split";
import { SectionCopy } from "./section-copy";

/** "Our philosophy — Scents are memories in another form." Inset portrait on blush. */
export function StorySplit({ image }: { image: string }) {
  return (
    <MediaSplit
      id="story"
      labelledBy="story-title"
      tone="blush"
      inset
      media={
        <CinematicImage
          src={image}
          alt="A woman in warm light holding a Solei all-over spray"
          sizes="(min-width: 1024px) 45vw, 100vw"
        />
      }
    >
      <SectionCopy
        id="story-title"
        eyebrow="Our philosophy"
        title={["Scents are memories", "in another form."]}
        action={<CircleArrowLink href="/story">Our story</CircleArrowLink>}
      >
        Inspired by travel, every Solei fragrance captures the atmosphere, emotion and essence of a
        destination — turning it into an experience you can make your own.
      </SectionCopy>
    </MediaSplit>
  );
}
