import Image from "next/image";
import Link from "next/link";
import { Container, Eyebrow, Section, SectionHeading } from "@/components/brand";
import { formatAED } from "@/lib/money";
import type { HomeContent } from "@/modules/content/queries";

export function Collection({ collection }: { collection: HomeContent["collection"] }) {
  return (
    <Section tone="sand" aria-labelledby="collection-title">
      <Container size="wide">
        <SectionHeading
          id="collection-title"
          eyebrow="The collection"
          title={
            <>
              Designed as a <span className="italic">journey.</span>
            </>
          }
          lede="Each scent offers its own atmosphere, character and emotional memory."
          align="center"
        />
        <ul className="mt-14 grid gap-8 md:grid-cols-2 lg:gap-12">
          {collection.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/shop/${c.slug}`}
                className="group bg-burgundy relative block overflow-hidden"
              >
                <div className="relative aspect-[4/5] sm:aspect-[5/4]">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 45vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className="from-burgundy-deep via-burgundy-deep/50 absolute inset-0 bg-gradient-to-t to-transparent"
                  />
                </div>
                <div className="text-cream absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-10">
                  <Eyebrow className="text-pink">
                    {c.count} {c.count === 1 ? "scent" : "scents"}
                  </Eyebrow>
                  <h3 className="text-cream text-3xl sm:text-4xl">{c.name}</h3>
                  <p className="text-cream/85 max-w-sm text-sm">{c.description}</p>
                  <p className="mt-2 flex items-center gap-4">
                    <span className="numeric font-display text-pink text-2xl">
                      {formatAED(c.fromFils)}
                    </span>
                    <span className="eyebrow text-cream/80 decoration-gold group-hover:decoration-pink text-[0.65rem] underline underline-offset-[6px]">
                      Discover
                    </span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
