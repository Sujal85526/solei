import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ShimmerImage } from "@/components/motion/shimmer-image";
import { Reveal, Stagger } from "@/components/motion/reveal";
import { formatAED } from "@/lib/money";
import type { StoreProduct } from "@/modules/storefront/types";
import { CarouselRail } from "./carousel-rail";
import { QuickAdd } from "./quick-add";

const typeLabel = (slug: string, fallback: string) =>
  slug === "perfume" ? "Eau de parfum" : slug === "all_over_spray" ? "All-over spray" : fallback;

/** "Signature Scents." — the catalogue (from the database) as an editorial product rail. */
export function SignatureScents({ products }: { products: StoreProduct[] }) {
  if (!products.length) return null;
  return (
    <section aria-labelledby="signature-title" className="bg-wine py-20 sm:py-28">
      <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
        <Reveal className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div>
            <p className="eyebrow text-pink/70">Featured</p>
            <h2 id="signature-title" className="display mt-4 text-5xl sm:text-6xl lg:text-7xl">
              Signature <span className="italic">Scents.</span>
            </h2>
          </div>
          <Link
            href="/shop"
            className="eyebrow group border-pink/30 text-pearl/85 hover:border-pink hover:text-pink hidden shrink-0 items-center gap-3 border-b pb-1 text-[0.65rem] sm:inline-flex"
          >
            Explore all{" "}
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
              strokeWidth={1.25}
            />
          </Link>
        </Reveal>

        <CarouselRail label="Signature scents">
          <Stagger as="ul" className="flex gap-5 sm:gap-7">
            {products.map((p) => {
              const variant = p.variants[0];
              const image = p.images[0];
              return (
                <li
                  key={p.id}
                  className="group relative w-[78vw] shrink-0 snap-start sm:w-[44vw] lg:w-[calc((100%-3.5rem)/3)]"
                >
                  <div className="bg-noir relative aspect-[4/5] overflow-hidden">
                    {image ? (
                      <ShimmerImage
                        src={image.url}
                        alt={image.alt || p.name}
                        fill
                        tone="dark"
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 44vw, 78vw"
                        className="object-cover transition-transform duration-[1200ms] ease-(--ease-soft) group-hover:scale-[1.04]"
                      />
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-pearl font-sans text-[0.8rem] font-normal tracking-[0.28em] uppercase">
                        <Link href={`/products/${p.slug}`} className="after:absolute after:inset-0">
                          {p.destination?.name ?? p.name}
                        </Link>
                      </h3>
                      <p className="text-pearl-muted mt-1.5 text-[0.65rem] tracking-[0.25em] uppercase">
                        {typeLabel(p.category.slug, p.category.name)}
                        {variant.label ? ` · ${variant.label}` : ""}
                      </p>
                      <p className="numeric text-pink mt-2 text-[0.75rem] tracking-[0.18em]">
                        {formatAED(variant.priceFils)}
                      </p>
                    </div>
                    <QuickAdd variantId={variant.id} name={p.name} />
                  </div>
                </li>
              );
            })}
          </Stagger>
        </CarouselRail>
      </div>
    </section>
  );
}
