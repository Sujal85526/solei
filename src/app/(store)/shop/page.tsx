import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/brand";
import { FilterChips } from "@/components/store/shop/filter-chips";
import { PageIntro } from "@/components/store/shop/page-intro";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { t } from "@/content/en";
import { filterProducts, parseShopFilters, shopHref } from "@/modules/storefront/filters";
import { listCategories, listDestinations, listProducts } from "@/modules/storefront/queries";

export const metadata: Metadata = {
  title: t.shop.title,
  description: t.shop.metaDescription,
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <PageIntro
        eyebrow={t.shop.eyebrow}
        title={
          <>
            Shop the <span className="italic">journey.</span>
          </>
        }
        lede={t.shop.lede}
      />
      <Container size="wide" className="pb-24 sm:pb-32">
        <Suspense fallback={<ShopSkeleton />}>
          <ShopResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

async function ShopResults({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const [params, products, categories, destinations] = await Promise.all([
    searchParams,
    listProducts(),
    listCategories(),
    listDestinations(),
  ]);
  const filters = parseShopFilters(params);
  const results = filterProducts(products, filters);

  const inCategory = filterProducts(products, { category: filters.category, destination: null });
  const destinationHas = (slug: string, category: string | null) =>
    products.some(
      (p) => p.destination?.slug === slug && (!category || p.category.slug === category),
    );

  const categoryChips = [
    {
      label: t.shop.all,
      href: shopHref({ category: null, destination: filters.destination }),
      active: !filters.category,
    },
    ...categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({
        label: c.name,
        href: shopHref({
          category: c.slug,
          destination:
            filters.destination && destinationHas(filters.destination, c.slug)
              ? filters.destination
              : null,
        }),
        active: filters.category === c.slug,
      })),
  ];
  const destinationChips = [
    {
      label: t.shop.all,
      href: shopHref({ category: filters.category, destination: null }),
      active: !filters.destination,
    },
    ...destinations
      .filter((d) => inCategory.some((p) => p.destination?.slug === d.slug))
      .map((d) => ({
        label: d.name,
        href: shopHref({ category: filters.category, destination: d.slug }),
        active: filters.destination === d.slug,
      })),
  ];
  const filtered = Boolean(filters.category || filters.destination);

  return (
    <>
      <div
        role="group"
        aria-label={t.shop.filters}
        className="border-pink/15 flex flex-col gap-5 border-y py-6"
      >
        <FilterChips label={t.shop.category} chips={categoryChips} />
        <FilterChips label={t.shop.destination} chips={destinationChips} />
      </div>
      <div className="flex items-baseline justify-between gap-4 pt-8 pb-10">
        <p className="eyebrow text-pearl-muted text-[0.65rem]" aria-live="polite">
          {t.shop.results(results.length)}
        </p>
        {filtered ? (
          <Link
            href="/shop"
            scroll={false}
            className="text-pink decoration-gold hover:decoration-pink text-sm underline underline-offset-4"
          >
            {t.shop.clearFilters}
          </Link>
        ) : null}
      </div>
      {results.length ? (
        <ProductGrid products={results} />
      ) : (
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <p className="font-display text-pink text-2xl italic">{t.shop.noResults}</p>
          <Link href="/shop" className="eyebrow text-pink underline underline-offset-8">
            {t.shop.viewAll}
          </Link>
        </div>
      )}
    </>
  );
}

function ShopSkeleton() {
  return (
    <div aria-busy>
      <div className="border-pink/15 flex flex-col gap-5 border-y py-6">
        <div className="bg-wine h-11 w-full max-w-md animate-pulse rounded-full" />
        <div className="bg-wine h-11 w-full max-w-2xl animate-pulse rounded-full" />
      </div>
      <div className="bg-wine mt-8 mb-10 h-3 w-24 animate-pulse" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
