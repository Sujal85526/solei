import { CinematicImage } from "@/components/motion/cinematic-image";
import { EarlyAccessForm } from "./early-access-form";
import { MediaSplit } from "./media-split";
import { SectionCopy } from "./section-copy";

/** "More than a fragrance." — the Solei gift bag (with a slow light sweep) beside the sign-up. */
export function Experience({ image }: { image: string }) {
  return (
    <MediaSplit
      labelledBy="experience-title"
      tone="blush"
      media={
        <div className="light-sweep absolute inset-0">
          <CinematicImage
            src={image}
            alt="A burgundy Solei gift bag with a satin ribbon in late-afternoon light"
            sizes="(min-width: 1024px) 58vw, 100vw"
            position="35% 50%"
          />
        </div>
      }
    >
      <SectionCopy
        id="experience-title"
        eyebrow="The experience"
        title={["More than", "a fragrance."]}
        action={<EarlyAccessForm />}
      >
        A memory, a feeling, and a little piece of somewhere that stays with you. Be first to hear
        about new destinations, pop-ups and private previews.
      </SectionCopy>
    </MediaSplit>
  );
}
