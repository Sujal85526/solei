import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductReviews } from "@/components/store/reviews/product-reviews";
import { ProductAccordions } from "@/components/store/shop/product-accordions";
import { ProductGallery } from "@/components/store/shop/product-gallery";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { PurchasePanel } from "@/components/store/shop/purchase-panel";
import { t } from "@/content/en";
import { publicEnv } from "@/lib/env";
import { formatAED } from "@/lib/money";
import { productTypeLabel } from "@/modules/storefront/labels";
import {
  availabilityFor,
  getCartSettings,
  getProduct,
  getRelatedProducts,
  listCategories,
  listProducts,
} from "@/modules/storefront/queries";
import type { StoreProduct } from "@/modules/storefront/types";

/**
 * Fully static: every known slug is prerendered, and an unknown slug waits for its static render
 * (instead of streaming a 200 shell) so `notFound()` answers with a real 404.
 */
export const ensureStatic = "navigation";

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
  // No VAT note while the business isn't VAT-registered (rate 0 in Admin settings).
  const vatNote = !settings.vatRateBp
    ? null
    : settings.pricesIncludeVat
      ? t.product.vatIncluded
      : t.product.vatExcluded;
  const purchaseProps = { variants: product.variants };
  const prices = product.variants.map((v) => v.priceFils);
  const title = product.destination
    ? [product.destination.name, productTypeLabel(product.category)]
    : [product.name];

  const notes = [
    [t.product.notesTop, product.notes.top],
    [t.product.notesHeart, product.notes.heart],
    [t.product.notesBase, product.notes.base],
  ].filter(([, list]) => list.length) as [string, string[]][];

  const accordions = [
    {
      title: t.product.fragranceNotes,
      // One group (the client's notes are a single list): no Top/Heart/Base label.
      body:
        notes.length === 1 ? (
          <p>{notes[0][1].join(", ")}</p>
        ) : notes.length ? (
          <dl className="flex flex-col gap-2">
            {notes.map(([label, list]) => (
              <div key={label} className="grid grid-cols-[5rem_1fr] gap-3">
                <dt className="eyebrow text-primary/60 pt-0.5 text-[0.58rem]">{label}</dt>
                <dd>{list.join(", ")}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{product.destination?.mood ?? product.description}</p>
        ),
    },
    {
      title: t.product.shippingReturns,
      body: (
        <div className="flex flex-col gap-2">
          <p>
            {t.product.deliveryLine}
            {settings.freeDeliveryThresholdFils !== null
              ? ` ${t.product.freeOver(formatAED(settings.freeDeliveryThresholdFils))}`
              : ""}
          </p>
          <p className="flex gap-5">
            <Link href="/help?tab=shipping" className="underline underline-offset-4">
              {t.product.deliveryPolicy}
            </Link>
            <Link href="/help?tab=returns" className="underline underline-offset-4">
              {t.product.returnsPolicy}
            </Link>
          </p>
        </div>
      ),
    },
    {
      title: t.product.details,
      body: (
        <dl className="flex flex-col gap-2">
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="eyebrow text-primary/60 pt-0.5 text-[0.58rem]">{t.product.category}</dt>
            <dd>
              <Link
                href={`/shop/${product.category.slug}`}
                className="underline underline-offset-4"
              >
                {category?.name ?? product.category.name}
              </Link>
            </dd>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <dt className="eyebrow text-primary/60 pt-0.5 text-[0.58rem]">{t.product.size}</dt>
            <dd>{product.variants.map((v) => v.label).join(" · ")}</dd>
          </div>
          {product.description ? <p className="mt-2">{product.description}</p> : null}
          {product.destination ? (
            <p className="mt-2">{t.product.stampNote(product.destination.name)}</p>
          ) : null}
        </dl>
      ),
    },
  ];

  return (
    <>
      <section aria-labelledby="product-title" className="grid lg:grid-cols-12">
        {/* data-hero: the glass header floats over the photograph. */}
        <div data-hero className="relative lg:sticky lg:top-0 lg:col-span-7 lg:h-svh">
          <ProductGallery images={product.images} name={product.name} />
        </div>
        <div className="on-blush flex flex-col px-6 pt-8 pb-14 sm:px-12 lg:col-span-5 lg:justify-center lg:px-14 lg:pt-24 lg:pb-16">
          <div className="lg:max-w-md">
            <h1 id="product-title" className="display hero-rise text-3xl leading-tight sm:text-4xl">
              {title[0]}
              {title[1] ? (
                <span className="text-primary mt-2 block font-sans text-xs tracking-[0.2em] uppercase not-italic">
                  {title[1]}
                </span>
              ) : null}
            </h1>
            <p
              className="numeric text-primary mt-4 text-sm tracking-[0.22em]"
              data-testid="product-price"
            >
              {new Set(prices).size > 1 ? `${t.shop.from} ` : ""}
              {formatAED(Math.min(...prices))}
            </p>
            {vatNote ? <p className="text-primary/55 mt-1 text-[0.7rem]">{vatNote}</p> : null}
            <span aria-hidden className="border-primary/20 mt-6 block border-t" />
            <div className="mt-8">
              <Suspense fallback={<PurchasePanel {...purchaseProps} availability={null} />}>
                <Purchase product={product} purchaseProps={purchaseProps} />
              </Suspense>
            </div>
            <div className="mt-8">
              <ProductAccordions items={accordions} />
            </div>
          </div>
        </div>
      </section>

      <Suspense fallback={null}>
        <ProductReviews productId={product.id} />
      </Suspense>

      <section aria-labelledby="related-title" className="on-blush py-16 sm:py-24">
        <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
          <div className="mb-8 sm:mb-12">
            <h2 id="related-title" className="eyebrow text-primary text-[0.62rem]">
              {t.product.youMayAlsoLike}
            </h2>
          </div>
          <Suspense fallback={<ProductGridSkeleton count={3} columns={relatedColumns} />}>
            <Related slug={product.slug} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

/** Two on phones (the third is hidden), three from tablets up. */
const relatedColumns = "md:grid-cols-3 [&>li:nth-child(3)]:hidden md:[&>li:nth-child(3)]:block";

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
  const related = await getRelatedProducts(slug, 3);
  return <ProductGrid products={related} columns={relatedColumns} />;
}
