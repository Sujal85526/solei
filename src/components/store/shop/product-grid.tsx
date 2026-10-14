import { cn } from "@/lib/utils";
import { availabilityFor } from "@/modules/storefront/queries";
import type { StoreProduct } from "@/modules/storefront/types";
import { ProductCard, ProductCardSkeleton } from "./product-card";

const gridClass =
  "grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:gap-x-10 lg:gap-y-16";

/** Product cards with stock badges. Reads cached availability — render inside <Suspense>. */
export async function ProductGrid({
  products,
  className,
  columns,
}: {
  products: StoreProduct[];
  className?: string;
  columns?: string;
}) {
  const availability = await availabilityFor(products);
  return (
    <ul className={cn(gridClass, columns, className)}>
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard
            product={p}
            priority={i < 2}
            available={p.variants.reduce((sum, v) => sum + (availability[v.id] ?? 0), 0)}
          />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({
  count = 4,
  className,
  columns,
}: {
  count?: number;
  className?: string;
  columns?: string;
}) {
  return (
    <ul className={cn(gridClass, columns, className)}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <ProductCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
