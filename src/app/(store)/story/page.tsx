import type { Metadata } from "next";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { CircleArrowLink } from "@/components/store/home/circle-arrow-link";
import { MediaSplit } from "@/components/store/home/media-split";
import { SectionCopy } from "@/components/store/home/section-copy";
import { storyCopy as c } from "@/content/story";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Our story: a quiet editorial page — hero, the brand line, two image/copy bands and a closing line.
 * Uses the homepage's motion (curtain photos with shimmer loading, rising headings).
 */
export default function StoryPage() {
  return (
    <>
      <section
        aria-labelledby="story-title"
        className="bg-noir grid min-h-[calc(100svh-4rem)] lg:grid-cols-12"
      >
        <div className="flex items-end px-6 pt-20 pb-14 sm:px-14 lg:col-span-5 lg:items-center lg:px-20 lg:py-24">
          <div className="max-w-md">
            <Reveal as="p" className="eyebrow text-primary/70">
              {c.hero.eyebrow}
            </Reveal>
            <SplitHeading
              as="h1"
              id="story-title"
              lines={[...c.hero.title]}
              className="mt-5 text-6xl sm:text-7xl lg:text-8xl"
            />
            <Reveal delay={300}>
              <span aria-hidden className="bg-primary/40 mt-8 block h-px w-12" />
              <p className="font-display text-pearl/85 mt-8 text-xl leading-relaxed italic">
                {c.hero.lede}
              </p>
            </Reveal>
          </div>
        </div>
        <div className="relative min-h-[70svh] overflow-hidden lg:col-span-7 lg:min-h-0">
          <CinematicImage
            src="/images/products/sprays-stone.jpg"
            alt="Three Solei all-over sprays resting on warm stone"
            sizes="(min-width: 1024px) 58vw, 100vw"
            position="50% 40%"
          />
        </div>
      </section>

      <section aria-label="Our belief" className="bg-noir px-6 py-24 sm:py-36">
        <Reveal className="mx-auto max-w-4xl text-center">
          <blockquote className="font-display text-shimmer text-pink text-3xl leading-snug italic sm:text-5xl sm:leading-tight">
            “{c.quote}”
          </blockquote>
        </Reveal>
      </section>

      <MediaSplit
        labelledBy="born-title"
        tone="blush"
        inset
        media={
          <CinematicImage
            src="/images/editorial/sunset-window.jpg"
            alt="Sunset over the sea through an open arched window"
            sizes="(min-width: 1024px) 45vw, 100vw"
          />
        }
      >
        <SectionCopy id="born-title" eyebrow={c.born.eyebrow} title={[...c.born.title]}>
          {c.born.body}
        </SectionCopy>
      </MediaSplit>

      <MediaSplit
        labelledBy="house-title"
        mediaSide="end"
        media={
          <CinematicImage
            src="/images/editorial/solei-bag.jpg"
            alt="A burgundy Solei shopping bag in warm evening light"
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
        }
      >
        <SectionCopy
          id="house-title"
          eyebrow={c.house.eyebrow}
          title={[...c.house.title]}
          action={<CircleArrowLink href="/shop">{c.house.cta}</CircleArrowLink>}
        >
          {c.house.body}
        </SectionCopy>
      </MediaSplit>

      <section aria-label={c.close} className="bg-noir border-pink/10 border-t px-6 py-24 sm:py-32">
        <Reveal className="mx-auto flex max-w-xl flex-col items-center gap-10 text-center">
          <p className="font-display text-pink text-3xl italic sm:text-4xl">{c.close}</p>
          <CircleArrowLink href="/destinations">{c.closeCta}</CircleArrowLink>
        </Reveal>
      </section>
    </>
  );
}
