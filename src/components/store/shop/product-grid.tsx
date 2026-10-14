import { cn } from "@/lib/utils";
import { availabilityFor } from "@/modules/storefront/queries";
import type { StoreProduct } from "@/modules/storefront/types";
import { QuickAdd } from "../cart/quick-add";
import { ProductCard, ProductCardSkeleton } from "./product-card";

const gridClass =
  "grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-16";

/** Product cards with stock badges. Reads cached availability — render inside <Suspense>. */
export async function ProductGrid({
  products,
  className,
  columns,
  quickAdd = false,
}: {
  products: StoreProduct[];
  className?: string;
  columns?: string;
  /** Show a one-tap "add to cart" on each photo (in-stock items). */
  quickAdd?: boolean;
}) {
  const availability = await availabilityFor(products);
  return (
    <ul className={cn(gridClass, columns, className)}>
      {products.map((p, i) => {
        const available = p.variants.reduce((sum, v) => sum + (availability[v.id] ?? 0), 0);
        return (
          <li key={p.id} className="relative">
            <ProductCard product={p} priority={i < 2} available={available} />
            {quickAdd && available > 0 ? (
              <QuickAdd
                variantId={p.variants[0].id}
                name={p.name}
                className="absolute end-4 top-4"
              />
            ) : null}
          </li>
        );
      })}
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
