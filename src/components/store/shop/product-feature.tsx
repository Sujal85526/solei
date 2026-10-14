import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow, OrnamentDivider } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/content/en";
import { formatAED } from "@/lib/money";
import { availabilityFor } from "@/modules/storefront/queries";
import type { StoreProduct } from "@/modules/storefront/types";

/**
 * Wide editorial block for a destination's scent(s): bottle photograph beside name, price and a
 * link to the product. Reads cached availability — render inside <Suspense>.
 */
export async function ProductFeatures({ products }: { products: StoreProduct[] }) {
  const availability = await availabilityFor(products);
  return (
    <ul className="flex flex-col gap-16">
      {products.map((p, i) => {
        const available = p.variants.reduce((s, v) => s + (availability[v.id] ?? 0), 0);
        // The destination photo is already the page hero; lead with the bottle shot if there is one.
        const image = p.images[1] ?? p.images[0];
        const from = Math.min(...p.variants.map((v) => v.priceFils));
        return (
          <li key={p.id} className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
            <Link
              href={`/products/${p.slug}`}
              className={`group bg-sand relative block aspect-[4/5] overflow-hidden md:col-span-6 lg:col-span-5 ${i % 2 ? "md:order-2" : ""}`}
              tabIndex={-1}
              aria-hidden
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.03]"
              />
              <div className="outline-cream/60 pointer-events-none absolute inset-3 outline outline-1" />
            </Link>
            <div className="flex flex-col gap-5 md:col-span-6 lg:col-span-6 lg:col-start-7">
              <Eyebrow>{p.category.name}</Eyebrow>
              <h3 className="text-4xl leading-tight sm:text-5xl">
                <Link href={`/products/${p.slug}`} className="hover:text-burgundy/80">
                  {p.name}
                </Link>
              </h3>
              {p.description ? (
                <p className="text-ink/80 max-w-md text-base leading-relaxed">{p.description}</p>
              ) : null}
              <OrnamentDivider className="max-w-56" />
              <p className="flex items-baseline gap-4">
                <span className="numeric font-display text-burgundy text-3xl">
                  {formatAED(from)}
                </span>
                <span className="text-ink-muted text-sm">
                  {p.variants.map((v) => v.label).join(" · ")}
                </span>
                {available === 0 ? (
                  <span className="eyebrow text-burgundy border-burgundy/30 border px-2.5 py-1 text-[0.6rem]">
                    {t.shop.soldOut}
                  </span>
                ) : null}
              </p>
              <Link
                href={`/products/${p.slug}`}
                className={`${buttonVariants({ size: "cta" })} self-start`}
              >
                {t.destinations.discover}
                <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
