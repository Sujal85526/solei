import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CollectionHero } from "@/components/store/shop/collection-hero";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { ShopToolbar } from "@/components/store/shop/shop-toolbar";
import { t } from "@/content/en";
import {
  filterProducts,
  parseShopFilters,
  SHOP_SORTS,
  shopHref,
} from "@/modules/storefront/filters";
import { listCategories, listDestinations, listProducts } from "@/modules/storefront/queries";

export const metadata: Metadata = {
  title: t.shop.title,
  description: t.shop.metaDescription,
  alternates: { canonical: "/shop" },
};

const GRID_ID = "collection";
const columns = "lg:grid-cols-3";

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <CollectionHero image="/images/editorial/collection-hero.jpg" targetId={GRID_ID} />
      <section id={GRID_ID} aria-label={t.shop.allFragrances} className="on-blush scroll-mt-16">
        <div className="mx-auto max-w-[96rem] px-6 pb-24 sm:px-10 sm:pb-32 lg:px-14">
          <Suspense
            fallback={<ProductGridSkeleton count={6} columns={columns} className="pt-10" />}
          >
            <ShopResults searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
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
      href: shopHref({ ...filters, category: null }),
      active: !filters.category,
    },
    ...categories
      .filter((c) => c.productCount > 0)
      .map((c) => ({
        label: c.name,
        href: shopHref({
          ...filters,
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
      href: shopHref({ ...filters, destination: null }),
      active: !filters.destination,
    },
    ...destinations
      .filter((d) => inCategory.some((p) => p.destination?.slug === d.slug))
      .map((d) => ({
        label: d.name,
        href: shopHref({ ...filters, destination: d.slug }),
        active: filters.destination === d.slug,
      })),
  ];
  const sortChips = SHOP_SORTS.map((sort) => ({
    label: t.shop.sorts[sort],
    href: shopHref({ ...filters, sort }),
    active: filters.sort === sort,
  }));
  const filtered = Boolean(filters.category || filters.destination || filters.sort !== "featured");

  return (
    <>
      <ShopToolbar
        count={results.length}
        filtered={filtered}
        groups={[
          { label: t.shop.category, chips: categoryChips },
          { label: t.shop.destination, chips: destinationChips },
          { label: t.shop.sort, chips: sortChips },
        ]}
      />
      {results.length ? (
        <ProductGrid products={results} columns={columns} className="pt-10" />
      ) : (
        <div className="flex flex-col items-center gap-6 py-20 text-center">
          <p className="font-display text-primary text-2xl italic">{t.shop.noResults}</p>
          <Link href="/shop" className="eyebrow text-primary underline underline-offset-8">
            {t.shop.viewAll}
          </Link>
        </div>
      )}
    </>
  );
}
