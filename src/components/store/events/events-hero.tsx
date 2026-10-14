import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { eventsCopy as c } from "@/content/events";

/** /events opener: editorial headline, occasions, two CTAs and the arch photo. */
export function EventsHero({ eventTypes, image }: { eventTypes: string[]; image: string }) {
  return (
    <section aria-labelledby="events-hero-title" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[96rem] items-center gap-12 px-6 pt-14 pb-16 sm:px-10 sm:pt-20 lg:grid-cols-12 lg:gap-20 lg:px-14 lg:pb-24">
        <div className="lg:col-span-7">
          <p className="eyebrow text-pink/70">{c.hero.eyebrow}</p>
          <h1 id="events-hero-title" className="display mt-5 text-6xl sm:text-7xl lg:text-8xl">
            {c.hero.title} <span className="italic">{c.hero.titleItalic}</span>
          </h1>
          <p className="text-pearl/85 mt-8 max-w-lg text-[0.95rem] leading-relaxed">
            {c.hero.lede}
          </p>
          {eventTypes.length ? (
            <ul aria-label="Occasions" className="mt-8 flex flex-wrap gap-2">
              {eventTypes.map((t) => (
                <li
                  key={t}
                  className="border-pink/30 text-pink border px-4 py-2 text-[0.65rem] tracking-[0.22em] uppercase"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#plan"
              className="group bg-pink text-burgundy hover:bg-pearl inline-flex h-12 items-center gap-4 px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
            >
              {c.hero.start}
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                strokeWidth={1.25}
              />
            </a>
            <a
              href="#packages"
              className="border-pink/40 text-pink hover:border-pink inline-flex h-12 items-center border px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
            >
              {c.hero.packages}
            </a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:col-span-5">
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full">
            <Image
              src={image}
              alt="A Solei perfume booth dressed with pink and burgundy florals"
              fill
              priority
              sizes="(min-width: 1024px) 30vw, 80vw"
              className="object-cover"
            />
          </div>
          <span
            aria-hidden
            className="border-pink/25 pointer-events-none absolute -inset-3 rounded-t-full border"
          />
        </div>
      </div>
    </section>
  );
}
