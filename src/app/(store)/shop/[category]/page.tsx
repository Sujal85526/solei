import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { ArchPalm, Container, Eyebrow, OrnamentDivider } from "@/components/brand";
import { Breadcrumbs } from "@/components/store/shop/page-intro";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { getCategory, listCategories, listProducts } from "@/modules/storefront/queries";

/**
 * Fully static: every known slug is prerendered, and an unknown slug waits for its static render
 * (instead of streaming a 200 shell) so `notFound()` answers with a real 404.
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await listCategories()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/shop/[category]">): Promise<Metadata> {
  const category = await getCategory((await params).category);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description || t.shop.metaDescription,
    alternates: { canonical: `/shop/${category.slug}` },
    openGraph: category.image ? { images: [category.image] } : undefined,
  };
}

export default async function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  const { category: slug } = await params;
  const [category, products] = await Promise.all([getCategory(slug), listProducts()]);
  if (!category) notFound();
  const items = products.filter((p) => p.category.slug === slug);

  return (
    <>
      <section
        aria-labelledby="category-title"
        className="bg-burgundy text-cream relative isolate overflow-hidden"
      >
        <div className="mx-auto grid max-w-[90rem] lg:grid-cols-12">
          <div className="relative aspect-[4/3] sm:aspect-[16/9] lg:order-2 lg:col-span-7 lg:aspect-auto lg:min-h-[32rem]">
            {category.image ? (
              <Image
                src={category.image}
                alt=""
                fill
                preload
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="bg-burgundy-deep flex h-full items-center justify-center">
                <ArchPalm className="text-pink/30 h-56" />
              </div>
            )}
            <div
              aria-hidden
              className="from-burgundy via-burgundy/10 lg:from-burgundy absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r lg:via-transparent"
            />
          </div>
          <div className="relative flex flex-col justify-center gap-6 px-5 pt-2 pb-14 sm:px-10 lg:col-span-5 lg:px-14 lg:py-20">
            <Breadcrumbs
              className="[&_a]:text-cream/70 [&_a:hover]:text-pink [&_[aria-current]]:text-pink"
              items={[{ href: "/shop", label: t.shop.title }, { label: category.name }]}
            />
            <h1 id="category-title" className="text-pink text-5xl leading-[1.02] sm:text-6xl">
              {category.name}
            </h1>
            {category.description ? (
              <p className="font-display text-cream/90 max-w-md text-lg leading-relaxed italic">
                {category.description}
              </p>
            ) : null}
            <OrnamentDivider className="max-w-48 opacity-70" />
            <p className="flex items-baseline gap-4">
              {category.fromFils !== null ? (
                <span className="numeric font-display text-pink text-2xl">
                  {formatAED(category.fromFils)}
                </span>
              ) : null}
              <span className="eyebrow text-cream/80 text-[0.65rem]">
                {items.length ? t.shop.results(items.length) : t.shop.comingSoon}
              </span>
            </p>
          </div>
        </div>
      </section>

      <Container size="wide" className="py-16 sm:py-24">
        {items.length ? (
          <Suspense fallback={<ProductGridSkeleton count={items.length} />}>
            <ProductGrid products={items} />
          </Suspense>
        ) : (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <Eyebrow lines>{t.shop.comingSoon}</Eyebrow>
            <p className="font-display text-burgundy max-w-md text-2xl leading-snug italic">
              {t.shop.comingSoonLede}
            </p>
          </div>
        )}
        <div className="mt-20 flex justify-center">
          <Link
            href="/shop"
            className="eyebrow text-burgundy hover:text-burgundy/70 inline-flex items-center gap-3"
          >
            <ArrowLeft className="size-4 rtl:rotate-180" strokeWidth={1.5} />
            {t.shop.viewAll}
          </Link>
        </div>
      </Container>
    </>
  );
}
