import Image from "next/image";
import Link from "next/link";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/modules/storefront/types";

/** Editorial product card: photograph, destination eyebrow, name, size and price. */
export function ProductCard({
  product,
  available,
  sizes = "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 45vw",
  priority = false,
}: {
  product: StoreProduct;
  /** Units available online across variants; `undefined` while unknown. */
  available?: number;
  sizes?: string;
  priority?: boolean;
}) {
  const image = product.images[0];
  const soldOut = available === 0;
  const prices = product.variants.map((v) => v.priceFils);
  const from = Math.min(...prices);
  const varies = new Set(prices).size > 1;
  const sizeLabel = product.variants
    .map((v) => v.label)
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block focus-visible:outline-none"
      data-testid="product-card"
    >
      <div className="bg-wine group-focus-visible:ring-pink relative aspect-[4/5] overflow-hidden group-focus-visible:ring-2 group-focus-visible:ring-offset-2">
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
        <div
          aria-hidden
          className="outline-cream/60 pointer-events-none absolute inset-2.5 outline outline-1"
        />
        {soldOut ? (
          <span className="bg-noir/95 text-pink eyebrow absolute start-4 top-4 px-3 py-1.5 text-[0.6rem]">
            {t.shop.soldOut}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 pt-4">
        {product.destination ? (
          <p className="eyebrow text-pink/70 text-[0.65rem]">
            {product.destination.name}
            <span className="text-pearl-muted/70 hidden xl:inline">
              {" "}
              · {product.destination.region}
            </span>
          </p>
        ) : null}
        <h3 className="font-display text-pink text-lg leading-snug sm:text-xl">{product.name}</h3>
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-pearl-muted">{sizeLabel || product.category.name}</span>
          <span className="numeric text-pink font-medium">
            {varies ? `${t.shop.from} ` : ""}
            {formatAED(from)}
          </span>
        </p>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="bg-wine aspect-[4/5]" />
      <div className="bg-wine mt-4 h-3 w-1/3" />
      <div className="bg-wine mt-3 h-5 w-2/3" />
      <div className="bg-wine mt-3 h-3 w-1/2" />
    </div>
  );
}
