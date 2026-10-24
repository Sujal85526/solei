import { ArrowDown, ArrowRight } from "lucide-react";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { eventsCopy as c } from "@/content/events";

/** /events opener on cream (like the Passport hero): headline, occasions, two CTAs, arch photo. */
export function EventsHero({ eventTypes, image }: { eventTypes: string[]; image: string }) {
  return (
    <section
      aria-labelledby="events-hero-title"
      className="bg-cream [--heading:var(--brand-burgundy)]"
    >
      <div className="mx-auto grid w-full max-w-[96rem] items-center gap-14 px-6 pt-14 pb-20 sm:px-10 lg:grid-cols-12 lg:gap-20 lg:px-14 lg:pt-20 lg:pb-28">
        <div className="max-w-xl lg:col-span-6">
          <Reveal as="p" className="eyebrow text-burgundy/70">
            {c.hero.eyebrow}
          </Reveal>
          <h1
            id="events-hero-title"
            className="display mt-5 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl"
          >
            {c.hero.title} <span className="italic">{c.hero.titleItalic}</span>
          </h1>
          <Reveal delay={200}>
            <span aria-hidden className="bg-burgundy/40 mt-8 hidden h-px w-12 lg:block" />
            <p className="text-ink/80 mt-6 max-w-md text-[0.95rem] leading-relaxed lg:mt-8">
              {c.hero.lede}
            </p>
            {eventTypes.length ? (
              <ul aria-label="Occasions" className="mt-8 flex flex-wrap gap-2">
                {eventTypes.map((t) => (
                  <li
                    key={t}
                    className="border-burgundy/25 text-burgundy rounded-full border px-4 py-1.5 text-[0.6rem] tracking-[0.22em] uppercase"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
              <a
                href="#plan"
                className="group bg-burgundy text-cream hover:bg-burgundy/90 inline-flex h-12 items-center gap-3 px-7 text-[0.7rem] tracking-[0.22em] uppercase transition-colors"
              >
                {c.hero.start}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                  strokeWidth={1.5}
                />
              </a>
              <a
                href="#packages"
                className="text-burgundy border-burgundy/40 hover:border-burgundy inline-flex items-center gap-2 border-b pb-0.5 text-sm transition-colors"
              >
                {c.hero.packages} <ArrowDown className="size-3.5" strokeWidth={1.5} />
              </a>
            </div>
          </Reveal>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <div className="arch relative mx-auto aspect-[4/5] w-full max-w-md">
            <CinematicImage
              src={image}
              alt="A Solei perfume booth dressed with pink and burgundy florals"
              sizes="(min-width: 1024px) 36vw, 90vw"
              drift="4%"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
