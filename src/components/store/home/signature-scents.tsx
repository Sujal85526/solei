import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { ProductGrid, ProductGridSkeleton } from "@/components/store/shop/product-grid";
import type { StoreProduct } from "@/modules/storefront/types";

const FEATURED_COUNT = 3;
const columns = "grid-cols-1 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3";

/** "Signature Scents." — three featured products from the catalogue, on blush. */
export function SignatureScents({ products }: { products: StoreProduct[] }) {
  const featured = products.slice(0, FEATURED_COUNT);
  if (!featured.length) return null;
  return (
    <section aria-labelledby="signature-title" className="on-blush py-20 sm:py-28">
      <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div>
            <Reveal as="p" className="eyebrow text-primary/70">
              Featured
            </Reveal>
            <SplitHeading
              id="signature-title"
              lines={["Signature", "Scents."]}
              className="mt-4 text-4xl sm:text-5xl lg:text-6xl"
            />
          </div>
          <Link
            href="/shop"
            className="eyebrow group text-primary border-primary/30 hover:border-primary inline-flex shrink-0 items-center gap-3 border-b pb-1 text-[0.65rem]"
          >
            Shop all
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
              strokeWidth={1.25}
            />
          </Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={FEATURED_COUNT} columns={columns} />}>
          <ProductGrid products={featured} columns={columns} quickAdd />
        </Suspense>
      </div>
    </section>
  );
}
