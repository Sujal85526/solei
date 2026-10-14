import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Container,
  Eyebrow,
  OrnamentDivider,
  PassportStamp,
  PostcardFrame,
  PostmarkWaves,
} from "@/components/brand";
import { Breadcrumbs } from "@/components/store/shop/page-intro";
import { ProductFeatures } from "@/components/store/shop/product-feature";
import { ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { t } from "@/content/en";
import { getDestination, listDestinations } from "@/modules/storefront/queries";

/**
 * Fully static: every known slug is prerendered, and an unknown slug waits for its static render
 * (instead of streaming a 200 shell) so `notFound()` answers with a real 404.
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await listDestinations()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const data = await getDestination((await params).slug);
  if (!data) return {};
  const { destination: d } = data;
  return {
    title: `${d.name} — ${d.region}`,
    description: `${d.mood} ${d.story}`.trim(),
    alternates: { canonical: `/destinations/${d.slug}` },
    openGraph: { images: [d.heroImage] },
  };
}

export default async function DestinationPage({ params }: PageProps<"/destinations/[slug]">) {
  const { slug } = await params;
  const [data, all] = await Promise.all([getDestination(slug), listDestinations()]);
  if (!data) notFound();
  const { destination: d, products } = data;
  const index = all.findIndex((x) => x.slug === d.slug);
  const prev = all[(index - 1 + all.length) % all.length];
  const next = all[(index + 1) % all.length];
  const accent = d.accent ?? "#460328";

  return (
    <article style={{ "--accent": accent } as CSSProperties}>
      {/* Hero: postcard + story opener, tinted with the destination's postcard colour */}
      <section aria-labelledby="destination-title" className="bg-sand relative overflow-hidden">
        <div aria-hidden className="h-1.5 bg-(--accent)" />
        <Container
          size="wide"
          className="grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-16 lg:pt-20 lg:pb-24"
        >
          <div className="flex flex-col gap-6 lg:col-span-5">
            <Breadcrumbs
              items={[{ href: "/destinations", label: t.destinations.title }, { label: d.name }]}
            />
            <Eyebrow>
              {[d.region, d.country].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ")}
            </Eyebrow>
            <h1
              id="destination-title"
              className="text-6xl leading-none tracking-[0.06em] uppercase sm:text-7xl lg:text-8xl"
            >
              {d.name}
            </h1>
            <p className="font-display text-ink/85 max-w-md text-xl leading-relaxed italic sm:text-2xl">
              {d.mood}
            </p>
            <div className="flex items-center gap-4 pt-2">
              <span
                aria-hidden
                className="ring-cream size-9 rounded-full bg-(--accent) shadow-sm ring-4"
              />
              <div className="flex flex-col">
                <span className="eyebrow text-gold-ink text-[0.6rem]">{t.destinations.accent}</span>
                <span className="text-ink-muted numeric text-xs tracking-[0.18em] uppercase">
                  {accent}
                </span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:col-span-7 lg:max-w-2xl">
            <PostmarkWaves
              className="absolute -start-6 -top-6 hidden w-44 sm:block"
              lines={4}
              width={180}
            />
            <PostcardFrame tilt={-1.5} className="p-3 sm:p-4">
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={d.heroImage}
                  alt={`${d.name}, ${d.region}`}
                  fill
                  preload
                  sizes="(min-width: 1024px) 42rem, 92vw"
                  className="object-cover"
                />
              </div>
              <div className="flex items-end justify-between gap-4 px-1 pt-4 pb-1">
                <p className="font-display text-burgundy text-lg tracking-[0.25em] uppercase sm:text-2xl">
                  {d.name}
                </p>
                <p className="text-ink-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  {t.brand.tagline}
                </p>
              </div>
            </PostcardFrame>
            <div aria-hidden className="absolute -end-2 -bottom-8 sm:-end-6">
              <PassportStamp
                label={d.name}
                sublabel={d.region}
                tilt={10}
                className="bg-cream/90 size-28 border-(--accent) text-(--accent) sm:size-32"
              />
            </div>
          </div>
        </Container>
      </section>

      {/* Story */}
      <section aria-labelledby="story-title" className="py-20 sm:py-28">
        <Container size="narrow" className="flex flex-col items-center gap-8 text-center">
          <Eyebrow lines>
            <span id="story-title">{t.destinations.story}</span>
          </Eyebrow>
          <p className="font-display text-burgundy text-3xl leading-snug italic sm:text-4xl">
            {d.story}
          </p>
          <OrnamentDivider className="w-full max-w-xs" />
        </Container>
      </section>

      {/* The scent */}
      <section aria-labelledby="scent-title" className="pb-20 sm:pb-28">
        <Container size="wide">
          <div className="mb-12 flex flex-col gap-3 sm:mb-16">
            <Eyebrow>{t.destinations.theScent}</Eyebrow>
            <h2 id="scent-title" className="text-4xl sm:text-5xl">
              {t.destinations.theScentLede(d.name)}
            </h2>
          </div>
          {products.length ? (
            <Suspense fallback={<ProductGridSkeleton count={1} columns="md:grid-cols-2" />}>
              <ProductFeatures products={products} />
            </Suspense>
          ) : (
            <p className="font-display text-ink-muted text-xl italic">
              {t.destinations.noProducts}
            </p>
          )}
        </Container>
      </section>

      {/* Onward */}
      <nav aria-label={t.destinations.title} className="border-burgundy/15 border-t">
        <Container size="wide" className="grid grid-cols-2 items-stretch">
          <Link
            href={`/destinations/${prev.slug}`}
            className="group border-burgundy/15 flex flex-col gap-2 border-e py-10 pe-4 sm:py-14"
          >
            <span className="eyebrow text-gold-ink flex items-center gap-2 text-[0.6rem]">
              <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.5} />
              <span className="sr-only sm:not-sr-only">{t.destinations.previous}</span>
            </span>
            <span className="font-display text-burgundy text-2xl tracking-[0.15em] uppercase transition-opacity group-hover:opacity-70 sm:text-3xl">
              {prev.name}
            </span>
          </Link>
          <Link
            href={`/destinations/${next.slug}`}
            className="group flex flex-col items-end gap-2 py-10 ps-4 text-end sm:py-14"
          >
            <span className="eyebrow text-gold-ink flex items-center gap-2 text-[0.6rem]">
              <span className="sr-only sm:not-sr-only">{t.destinations.next}</span>
              <ArrowRight className="size-3.5 rtl:rotate-180" strokeWidth={1.5} />
            </span>
            <span className="font-display text-burgundy text-2xl tracking-[0.15em] uppercase transition-opacity group-hover:opacity-70 sm:text-3xl">
              {next.name}
            </span>
          </Link>
        </Container>
        <div className="border-burgundy/15 border-t py-8 text-center">
          <Link href="/destinations" className="eyebrow text-burgundy hover:opacity-70">
            {t.destinations.allDestinations}
          </Link>
        </div>
      </nav>
    </article>
  );
}
