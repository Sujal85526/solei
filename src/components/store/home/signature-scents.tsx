import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { QuickAdd } from "@/components/store/cart/quick-add";
import { CardGallery } from "@/components/store/shop/card-gallery";
import { formatAED } from "@/lib/money";
import type { StoreProduct } from "@/modules/storefront/types";

export type ShelfItem = { product: StoreProduct; image: string };

/**
 * "Signature Scents." — three featured bottles; swipe a photo to see the product's other photos.
 * Each opens its product page; name, price and a quick add sit beneath it.
 */
export function SignatureScents({ items }: { items: ShelfItem[] }) {
  if (!items.length) return null;
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

        <Stagger as="ul" className="grid gap-y-10 sm:grid-cols-3 sm:gap-y-0">
          {items.map(({ product, image }) => (
            <li key={product.id}>
              <ShelfBottle product={product} image={image} />
            </li>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function ShelfBottle({ product, image }: ShelfItem) {
  const variant = product.variants[0];
  const href = `/products/${product.slug}`;
  return (
    <article className="group">
      <Link
        href={href}
        aria-label={`${product.name} — view`}
        className="relative block aspect-[1280/935] overflow-hidden"
      >
        <CardGallery
          images={product.images.length ? product.images : [{ url: image, alt: product.name }]}
          sizes="(min-width: 640px) 33vw, 100vw"
          imageClassName="transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.04]"
        />
        <span className="text-burgundy bg-pearl/85 absolute start-1/2 bottom-5 -translate-x-1/2 translate-y-2 px-4 py-2 text-[0.6rem] tracking-[0.3em] uppercase opacity-0 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 rtl:translate-x-1/2">
          View
        </span>
      </Link>
      <div className="flex items-center justify-between gap-4 pt-5 sm:px-5">
        <div>
          <p className="eyebrow text-primary/70 text-[0.6rem]">{product.destination?.name}</p>
          <h3 className="font-display text-primary mt-1 text-xl leading-snug">
            <Link href={href}>{product.name}</Link>
          </h3>
          <p className="numeric text-primary mt-1 text-sm">{formatAED(variant.priceFils)}</p>
        </div>
        <QuickAdd variantId={variant.id} name={product.name} />
      </div>
    </article>
  );
}
