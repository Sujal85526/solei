import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container, Eyebrow, OrnamentDivider, PassportStamp } from "@/components/brand";
import { Breadcrumbs } from "@/components/store/shop/page-intro";
import { ProductGallery } from "@/components/store/shop/product-gallery";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { PurchasePanel } from "@/components/store/shop/purchase-panel";
import { t } from "@/content/en";
import { publicEnv } from "@/lib/env";
import {
  availabilityFor,
  getCartSettings,
  getProduct,
  getRelatedProducts,
  listCategories,
  listProducts,
} from "@/modules/storefront/queries";
import type { StoreProduct } from "@/modules/storefront/types";

export async function generateStaticParams() {
  return (await listProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description || t.shop.metaDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { images: product.images.map((i) => ({ url: i.url, alt: i.alt })) },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const [product, settings, categories] = await Promise.all([
    getProduct(slug),
    getCartSettings(),
    listCategories(),
  ]);
  if (!product) notFound();
  const category = categories.find((c) => c.slug === product.category.slug);
  const vatNote = settings.pricesIncludeVat ? t.product.vatIncluded : t.product.vatExcluded;
  const purchaseProps = {
    product: {
      name: product.name,
      destinationName: product.destination?.name ?? null,
      image: product.images[0],
    },
    variants: product.variants,
    vatNote,
  };
  const notes = [
    [t.product.notesTop, product.notes.top],
    [t.product.notesHeart, product.notes.heart],
    [t.product.notesBase, product.notes.base],
  ].filter(([, list]) => list.length) as [string, string[]][];

  return (
    <>
      <Container size="wide" className="pt-6 pb-16 sm:pt-10 sm:pb-24">
        <Breadcrumbs
          className="mb-6 sm:mb-10"
          items={[
            { href: "/shop", label: t.shop.title },
            {
              href: `/shop/${product.category.slug}`,
              label: category?.name ?? product.category.name,
            },
            { label: product.name },
          ]}
        />
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="-mx-5 sm:mx-0 lg:col-span-7">
            <ProductGallery images={product.images} name={product.name} />
          </div>

          <div className="flex flex-col gap-8 lg:col-span-5 lg:pt-4">
            <div className="flex flex-col gap-4">
              {product.destination ? (
                <Link
                  href={`/destinations/${product.destination.slug}`}
                  className="eyebrow text-gold-ink self-start hover:opacity-70"
                >
                  {product.destination.name} · {product.destination.region}
                </Link>
              ) : null}
              <h1 className="text-5xl leading-[1.02] sm:text-6xl">{product.name}</h1>
              {product.destination?.mood ? (
                <p className="font-display text-ink/80 text-xl leading-relaxed italic">
                  {product.destination.mood}
                </p>
              ) : null}
            </div>

            <Suspense fallback={<PurchasePanel {...purchaseProps} availability={null} />}>
              <Purchase product={product} purchaseProps={purchaseProps} />
            </Suspense>

            <OrnamentDivider />

            {product.description ? (
              <p className="text-ink/85 text-base leading-relaxed">{product.description}</p>
            ) : null}

            {notes.length ? (
              <section aria-labelledby="notes-title" className="flex flex-col gap-4">
                <h2 id="notes-title" className="eyebrow text-gold-ink font-display text-xs">
                  {t.product.notes}
                </h2>
                <dl className="divide-burgundy/10 border-burgundy/10 divide-y border-y">
                  {notes.map(([label, list]) => (
                    <div key={label} className="grid grid-cols-[6rem_1fr] gap-4 py-3 text-sm">
                      <dt className="text-ink-muted tracking-[0.18em] uppercase">{label}</dt>
                      <dd className="text-ink">{list.join(", ")}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {product.destination ? (
              <aside className="bg-pink-wash flex items-center gap-5 p-5 sm:p-6">
                <div aria-hidden className="shrink-0">
                  <PassportStamp
                    label={product.destination.name}
                    tilt={-8}
                    className="bg-cream/70 size-20"
                    compact
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="eyebrow text-burgundy text-[0.65rem]">{t.product.stampTitle}</p>
                  <p className="text-ink/85 text-sm leading-relaxed">
                    {t.product.stampNote(product.destination.name)}
                  </p>
                </div>
              </aside>
            ) : null}

            <dl className="text-ink-muted grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="eyebrow text-gold-ink text-[0.6rem]">{t.product.category}</dt>
                <dd>
                  <Link
                    href={`/shop/${product.category.slug}`}
                    className="text-burgundy decoration-gold underline underline-offset-4"
                  >
                    {category?.name ?? product.category.name}
                  </Link>
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="eyebrow text-gold-ink text-[0.6rem]">{t.product.size}</dt>
                <dd>{product.variants.map((v) => v.label).join(" · ")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Container>

      <section aria-labelledby="related-title" className="bg-sand py-20 sm:py-28">
        <Container size="wide">
          <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-3">
              <Eyebrow>{t.product.relatedLede}</Eyebrow>
              <h2 id="related-title" className="text-4xl sm:text-5xl">
                {t.product.related}
              </h2>
            </div>
            <Link href="/shop" className="eyebrow text-burgundy shrink-0 hover:opacity-70">
              {t.shop.viewAll}
            </Link>
          </div>
          <Suspense fallback={<ProductGridSkeleton count={4} />}>
            <Related slug={product.slug} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}

async function Purchase({
  product,
  purchaseProps,
}: {
  product: StoreProduct;
  purchaseProps: Omit<Parameters<typeof PurchasePanel>[0], "availability">;
}) {
  const availability = await availabilityFor([product]);
  const site = publicEnv.NEXT_PUBLIC_SITE_URL;
  const abs = (url: string) => (url.startsWith("http") ? url : `${site}${url}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: product.images.map((i) => abs(i.url)),
    sku: product.variants[0].sku,
    brand: { "@type": "Brand", name: "Solei" },
    category: product.category.name,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      name: v.label || undefined,
      price: (v.priceFils / 100).toFixed(2),
      priceCurrency: "AED",
      availability:
        (availability[v.id] ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: abs(`/products/${product.slug}`),
    })),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <PurchasePanel {...purchaseProps} availability={availability} />
    </>
  );
}

async function Related({ slug }: { slug: string }) {
  const related = await getRelatedProducts(slug);
  return <ProductGrid products={related} />;
}
