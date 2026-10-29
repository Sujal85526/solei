import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { GiveawayCard } from "@/components/store/giveaways/giveaway-card";
import { giveawaysCopy as c } from "@/content/giveaways";
import { cn } from "@/lib/utils";
import { giveawaysFor } from "@/modules/giveaways/flow";
import { listGiveaways, listOccasions } from "@/modules/giveaways/queries";

export const metadata: Metadata = {
  title: c.meta.title,
  description: c.meta.description,
  alternates: { canonical: "/giveaways" },
};

/**
 * Giveaways & occasions: the occasions as photo tiles (Admin → Products → Occasions), each one
 * filtering the customisable giveaways below (`?occasion=wedding`).
 */
export default function GiveawaysPage({ searchParams }: PageProps<"/giveaways">) {
  return (
    <section aria-labelledby="giveaways-title" data-solid-header className="on-blush">
      <div className="mx-auto max-w-[96rem] px-6 pt-14 pb-24 sm:px-10 sm:pt-20 lg:px-14 lg:pb-32">
        <Reveal as="p" className="eyebrow text-primary/70">
          {c.eyebrow}
        </Reveal>
        <SplitHeading
          as="h1"
          id="giveaways-title"
          lines={[c.title]}
          className="mt-5 text-5xl sm:text-6xl lg:text-7xl"
        />
        <Reveal delay={250}>
          <span aria-hidden className="bg-primary/40 mt-8 block h-px w-12" />
          <p className="text-foreground/80 mt-8 max-w-xl text-[0.95rem] leading-relaxed">
            {c.lede}
          </p>
        </Reveal>
        <Suspense fallback={<div className="mt-14 min-h-96" />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/giveaways">, "searchParams">) {
  const [params, occasions, giveaways] = await Promise.all([
    searchParams,
    listOccasions(),
    listGiveaways(),
  ]);
  const wanted = typeof params.occasion === "string" ? params.occasion : null;
  const active = occasions.find((o) => o.slug === wanted) ?? null;
  const results = giveawaysFor(giveaways, active?.slug);

  return (
    <>
      {occasions.length ? (
        <nav aria-label={c.occasions} className="mt-14">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {occasions.map((o) => {
              const on = active?.slug === o.slug;
              return (
                <li key={o.id}>
                  <Link
                    href={on ? "/giveaways" : `/giveaways?occasion=${o.slug}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={cn(
                      "group focus-visible:ring-primary relative block aspect-[4/5] overflow-hidden focus-visible:ring-2 focus-visible:outline-none",
                      on && "ring-primary ring-2 ring-offset-2",
                    )}
                    data-testid="occasion-tile"
                  >
                    {o.image ? (
                      <Image
                        src={o.image}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 18vw, 45vw"
                        className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span className="bg-primary/15 absolute inset-0" />
                    )}
                    <span className="from-noir/80 absolute inset-0 bg-gradient-to-t via-transparent" />
                    <span className="text-pearl absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
                      <span className="font-display text-xl tracking-[0.06em] uppercase">
                        {o.name}
                      </span>
                      {o.blurb ? (
                        <span className="line-clamp-2 text-[0.72rem] leading-snug opacity-85">
                          {o.blurb}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div className="border-primary/15 mt-12 flex items-baseline justify-between border-b pb-3">
        <h2 className="eyebrow text-primary text-[0.62rem]">{active?.name ?? c.all}</h2>
        {active ? (
          <Link
            href="/giveaways"
            scroll={false}
            className="eyebrow text-primary/70 text-[0.6rem] underline underline-offset-4"
          >
            {c.viewAll}
          </Link>
        ) : null}
      </div>
      {results.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 pt-10 sm:gap-x-6 lg:grid-cols-3">
          {results.map((g) => (
            <li key={g.id}>
              <GiveawayCard giveaway={g} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <p className="font-display text-primary text-2xl italic">{c.noResults}</p>
          <Link href="/contact" className="eyebrow text-primary underline underline-offset-8">
            {c.contact}
          </Link>
        </div>
      )}
    </>
  );
}
