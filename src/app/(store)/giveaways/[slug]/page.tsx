import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GiveawayFlow } from "@/components/store/giveaways/giveaway-flow";
import { ProductGallery } from "@/components/store/shop/product-gallery";
import { giveawaysCopy as c } from "@/content/giveaways";
import { formatAED } from "@/lib/money";
import { giveawayFromFils } from "@/modules/giveaways/flow";
import { getGiveaway, listGiveaways } from "@/modules/giveaways/queries";
import type { StoreGiveaway } from "@/modules/giveaways/types";
import { getAvailability } from "@/modules/storefront/queries";

export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await listGiveaways()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/giveaways/[slug]">): Promise<Metadata> {
  const giveaway = await getGiveaway((await params).slug);
  if (!giveaway) return {};
  return {
    title: giveaway.name,
    description: giveaway.description || c.meta.description,
    alternates: { canonical: `/giveaways/${giveaway.slug}` },
    openGraph: { images: giveaway.images.map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

/** A giveaway: photographs beside the guided order (type → scent → packaging → quantity → names). */
export default async function GiveawayPage({ params }: PageProps<"/giveaways/[slug]">) {
  const giveaway = await getGiveaway((await params).slug);
  if (!giveaway) notFound();

  return (
    <section aria-labelledby="giveaway-title" className="grid lg:grid-cols-12">
      <div data-hero className="relative lg:sticky lg:top-0 lg:col-span-7 lg:h-svh">
        <ProductGallery images={giveaway.images} name={giveaway.name} />
      </div>
      <div className="on-blush flex flex-col px-6 pt-8 pb-14 sm:px-12 lg:col-span-5 lg:px-14 lg:pt-24 lg:pb-16">
        <div className="lg:max-w-md">
          <Link
            href="/giveaways"
            className="eyebrow text-primary/60 text-[0.6rem] underline-offset-4 hover:underline"
          >
            {c.eyebrow}
          </Link>
          <h1
            id="giveaway-title"
            className="display hero-rise mt-3 text-3xl leading-tight sm:text-4xl"
          >
            {giveaway.name}
          </h1>
          <p className="numeric text-primary mt-4 text-sm tracking-[0.22em]">
            {c.from} {formatAED(giveawayFromFils(giveaway))}
            {giveaway.minOrderQty > 1 ? ` · ${c.minPieces(giveaway.minOrderQty)}` : ""}
          </p>
          {giveaway.description ? (
            <p className="text-foreground/80 mt-4 text-[0.92rem] leading-relaxed whitespace-pre-line">
              {giveaway.description}
            </p>
          ) : null}
          <span aria-hidden className="border-primary/20 mt-6 block border-t" />
          <div className="mt-8">
            <Suspense fallback={<GiveawayFlow giveaway={giveaway} availability={null} />}>
              <Flow giveaway={giveaway} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

async function Flow({ giveaway }: { giveaway: StoreGiveaway }) {
  const availability = await getAvailability(giveaway.items.map((i) => i.variantId).sort());
  return <GiveawayFlow giveaway={giveaway} availability={availability} />;
}
