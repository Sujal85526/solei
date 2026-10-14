import { ImageCycle, type CycleImage } from "@/components/motion/image-cycle";
import { EarlyAccessForm } from "./early-access-form";
import { MediaSplit } from "./media-split";
import { SectionCopy } from "./section-copy";

/**
 * "More than a fragrance." — a crossfading sequence (pop-up moments and the Solei bag) beside the
 * early-access sign-up.
 */
export function Experience({ images }: { images: CycleImage[] }) {
  return (
    <MediaSplit
      labelledBy="experience-title"
      tone="blush"
      media={<ImageCycle images={images} sizes="(min-width: 1024px) 58vw, 100vw" />}
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
