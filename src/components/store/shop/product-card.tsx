import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { QuickAdd } from "@/components/store/cart/quick-add";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/modules/storefront/types";

/**
 * Collection card: square photograph, the destination in serif capitals, a hairline, then the
 * price and a one-tap add. Colours follow the surrounding theme.
 */
export function ProductCard({
  product,
  available,
  sizes = "(min-width: 1024px) 30vw, 50vw",
  priority = false,
  sale,
}: {
  product: StoreProduct;
  /** A live sale on this product: its name and the lowest price after it. */
  sale?: { name: string; priceFils: number };
  /** Units available online across variants; `undefined` while unknown. */
  available?: number;
  sizes?: string;
  priority?: boolean;
}) {
  const image = product.images[0];
  const href = `/products/${product.slug}`;
  const soldOut = available === 0;
  const prices = product.variants.map((v) => v.priceFils);
  const varies = new Set(prices).size > 1;
  const title = product.destination?.name ?? product.name;

  return (
    <article className="group" data-testid="product-card">
      <Link
        href={href}
        aria-label={product.name}
        className="bg-noir/10 focus-visible:ring-primary relative block aspect-square overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
      >
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes={sizes}
          preload={priority}
          className={cn(
            "object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.04]",
            soldOut && "opacity-70 grayscale-[35%]",
          )}
        />
        {soldOut ? (
          <span className="bg-noir/90 text-pink eyebrow absolute start-3 top-3 px-3 py-1.5 text-[0.6rem]">
            {t.shop.soldOut}
          </span>
        ) : sale ? (
          <span className="bg-primary text-primary-foreground eyebrow absolute start-3 top-3 px-3 py-1.5 text-[0.6rem]">
            {t.shop.sale}
          </span>
        ) : null}
      </Link>
      <div className="pt-4">
        <h3 className="font-display text-primary text-lg leading-tight tracking-[0.06em] uppercase sm:text-xl">
          <Link href={href}>{title}</Link>
        </h3>
        <div className="border-primary/20 mt-3 flex min-h-[3.25rem] items-center justify-between gap-3 border-t pt-3">
          <span className="numeric text-primary text-[0.7rem] tracking-[0.18em] sm:text-xs">
            {varies ? `${t.shop.from} ` : ""}
            {sale ? (
              <>
                <s className="text-muted-foreground me-1.5">{formatAED(Math.min(...prices))}</s>
                <span title={sale.name}>{formatAED(sale.priceFils)}</span>
              </>
            ) : (
              formatAED(Math.min(...prices))
            )}
          </span>
          {soldOut ? null : product.optionGroups.length || product.minOrderQty > 1 ? (
            // Giveaways need choices (and a quantity) first: the + opens the product. Same bare
            // plus as QuickAdd.
            <Link
              href={`/products/${product.slug}`}
              aria-label={`${t.product.customise}: ${product.name}`}
              className="text-primary z-10 -me-2 flex size-10 shrink-0 items-center justify-center transition-opacity duration-300 hover:opacity-60"
            >
              <Plus className="size-5" strokeWidth={1.25} />
            </Link>
          ) : (
            <QuickAdd variantId={product.variants[0].id} name={product.name} />
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="bg-primary/10 aspect-square" />
      <div className="bg-primary/10 mt-4 h-5 w-1/2" />
      <div className="bg-primary/10 mt-2 h-3 w-1/3" />
      <div className="bg-primary/10 mt-4 h-3 w-full" />
    </div>
  );
}
