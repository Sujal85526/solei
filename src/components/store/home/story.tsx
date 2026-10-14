import Image from "next/image";
import {
  ArchPalm,
  Container,
  Eyebrow,
  OrnamentDivider,
  PostcardFrame,
  Postmark,
  Section,
} from "@/components/brand";
import { t } from "@/content/en";

export function BrandStory() {
  return (
    <Section aria-labelledby="story-title" id="story" className="relative overflow-hidden">
      <ArchPalm className="text-gold/25 pointer-events-none absolute -start-8 top-16 hidden h-96 xl:block" />
      <Container className="grid items-center gap-16 lg:grid-cols-2">
        <div className="relative order-2 mx-auto w-full max-w-md lg:order-1">
          <PostcardFrame tilt={-2}>
            <Image
              src="/images/products/sprays-stone.jpg"
              alt="Soho all-over sprays resting on warm sandstone"
              width={1070}
              height={1470}
              sizes="(min-width: 1024px) 28rem, 90vw"
              className="aspect-[4/5] object-cover"
            />
          </PostcardFrame>
          <Postmark className="bg-cream/0 text-burgundy/60 absolute -end-6 -bottom-8 size-28 rotate-12 sm:-end-10" />
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <Eyebrow>The brand story</Eyebrow>
          <h2 id="story-title" className="text-4xl leading-[1.05] sm:text-5xl">
            Inspired by destinations, memory and{" "}
            <span className="italic">the feeling of staying.</span>
          </h2>
          <p className="font-display text-burgundy text-xl leading-relaxed italic">
            &ldquo;Fragrance is more than something you wear. It&apos;s a memory, a feeling, and a
            little piece of somewhere that stays with you.&rdquo;
          </p>
          <OrnamentDivider className="max-w-xs" />
          <p className="text-ink-muted leading-relaxed">
            Solei is a UAE-based fragrance house born from a love of travel and the power of scent.
            Each fragrance is named after a destination, turning places into wearable memories —
            from the notes in the bottle to the packaging in your hands.
          </p>
          <p className="text-ink-muted leading-relaxed">
            Our vision is a fragrance house beyond the traditional: travel, storytelling and scent
            together, so that every purchase feels like an experience. {t.brand.invitation}
          </p>
          <p className="eyebrow text-burgundy">{t.brand.tagline}</p>
        </div>
      </Container>
    </Section>
  );
}
