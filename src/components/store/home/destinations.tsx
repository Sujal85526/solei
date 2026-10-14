import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, PostcardFrame, Section, SectionHeading } from "@/components/brand";
import { formatAED } from "@/lib/money";
import type { HomeDestination } from "@/modules/content/queries";

const tilts = [-1.5, 1, -0.5, 1.5, 1, -1.5, 0.5, -1];

export function ShopByDestination({ destinations }: { destinations: HomeDestination[] }) {
  return (
    <Section aria-labelledby="destinations-title" className="overflow-hidden">
      <Container size="wide">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="destinations-title"
            eyebrow="Shop by destination"
            title={
              <>
                Eight places, <span className="italic">one journey.</span>
              </>
            }
            lede="Every Solei scent is named for a destination — its notes, its mood, its memory."
          />
          <Link
            href="/destinations"
            className="eyebrow text-burgundy inline-flex shrink-0 items-center gap-2 hover:opacity-70"
          >
            All destinations <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
          </Link>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-4 lg:gap-x-8 lg:gap-y-14">
          {destinations.map((d, i) => (
            <li key={d.slug}>
              <Link
                href={`/destinations/${d.slug}`}
                className="group block focus-visible:outline-none"
              >
                <PostcardFrame
                  tilt={tilts[i % tilts.length]}
                  className="group-focus-visible:ring-burgundy transition-transform duration-500 ease-(--ease-soft) group-hover:-translate-y-1 group-hover:!rotate-0 group-focus-visible:ring-2"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={d.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 22vw, 45vw"
                      className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1 px-2 pt-3 pb-1.5 text-center">
                    <h3 className="font-display text-lg tracking-[0.2em] uppercase sm:text-xl">
                      {d.name}
                    </h3>
                    <p className="text-ink-muted text-[0.7rem] tracking-[0.18em] uppercase">
                      {d.region}
                    </p>
                  </div>
                </PostcardFrame>
                <p className="text-ink-muted mt-4 hidden text-sm leading-relaxed sm:block">
                  {d.mood}
                </p>
                <p className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-ink-muted">{d.categoryName}</span>
                  <span className="numeric text-burgundy font-medium">
                    {formatAED(d.priceFils)}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
