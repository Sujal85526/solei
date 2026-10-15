import type { Metadata } from "next";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { MediaSplit } from "@/components/store/home/media-split";
import { SectionCopy } from "@/components/store/home/section-copy";
import { storyCopy as c } from "@/content/story";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Our story — the client's own words: tagline hero, the brand line, About Solei, who we are /
 * mission / vision, and the founder statement. Homepage motion (curtain photos, rising headings).
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

      <section aria-label={c.hero.lede} className="bg-noir px-6 py-24 sm:py-36">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="font-display text-shimmer text-pink text-4xl leading-snug italic sm:text-6xl sm:leading-tight">
            {c.hero.lede}
          </p>
        </Reveal>
      </section>

      <MediaSplit
        labelledBy="about-title"
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
        <SectionCopy id="about-title" eyebrow={c.about.eyebrow} title={[...c.about.title]}>
          {c.about.body.map((p) => (
            <p key={p.slice(0, 20)} className="mt-4 first:mt-0">
              {p}
            </p>
          ))}
        </SectionCopy>
      </MediaSplit>

      <section
        aria-label={c.pillars.map((p) => p.title).join(", ")}
        className="bg-noir mx-auto max-w-[96rem] px-6 py-20 sm:px-10 sm:py-28 lg:px-14"
      >
        <ul className="grid gap-12 sm:grid-cols-3 sm:gap-10">
          {c.pillars.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 120} className="flex flex-col gap-5">
              <span aria-hidden className="bg-primary/40 block h-px w-12" />
              <h2 className="text-3xl italic">{p.title}</h2>
              <p className="text-pearl/75 max-w-sm text-sm leading-relaxed">{p.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <MediaSplit
        labelledBy="founder-title"
        mediaSide="end"
        media={
          <CinematicImage
            src="/images/editorial/solei-bag.jpg"
            alt="A burgundy Solei shopping bag in warm evening light"
            sizes="(min-width: 1024px) 58vw, 100vw"
          />
        }
      >
        <SectionCopy id="founder-title" eyebrow={c.founder.eyebrow} title={[...c.founder.title]}>
          {c.founder.body.map((p) => (
            <p key={p.slice(0, 20)} className="mt-4 first:mt-0">
              {p}
            </p>
          ))}
        </SectionCopy>
      </MediaSplit>
    </>
  );
}
