import Image from "next/image";
import Link from "next/link";
import { giveawaysCopy as c } from "@/content/giveaways";
import { formatAED } from "@/lib/money";
import { giveawayFromFils } from "@/modules/giveaways/flow";
import type { StoreGiveaway } from "@/modules/giveaways/types";

/** Giveaway card: photograph, name, occasions, "From AED x · from 50 pieces". */
export function GiveawayCard({ giveaway: g }: { giveaway: StoreGiveaway }) {
  const href = `/giveaways/${g.slug}`;
  const image = g.images[0];
  return (
    <article className="group" data-testid="giveaway-card">
      <Link
        href={href}
        aria-label={g.name}
        className="bg-noir/10 focus-visible:ring-primary relative block aspect-square overflow-hidden focus-visible:ring-2 focus-visible:outline-none"
      >
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 30vw, 50vw"
          className="object-cover transition-transform duration-700 ease-(--ease-soft) group-hover:scale-[1.04]"
        />
      </Link>
      <div className="pt-4">
        <h3 className="font-display text-primary text-lg leading-tight tracking-[0.06em] uppercase sm:text-xl">
          <Link href={href}>{g.name}</Link>
        </h3>
        {g.occasions.length ? (
          <p className="text-primary/60 mt-1 text-xs">
            {g.occasions.map((o) => o.name).join(" · ")}
          </p>
        ) : null}
        <div className="border-primary/20 mt-3 flex min-h-[3.25rem] items-center justify-between gap-3 border-t pt-3">
          <span className="numeric text-primary text-[0.7rem] tracking-[0.18em] sm:text-xs">
            {c.from} {formatAED(giveawayFromFils(g))}
            {g.minOrderQty > 1 ? (
              <span className="text-primary/60 block tracking-normal">
                {c.minPieces(g.minOrderQty)}
              </span>
            ) : null}
          </span>
          <Link
            href={href}
            className="eyebrow text-primary text-[0.6rem] underline underline-offset-4"
          >
            {c.customise}
          </Link>
        </div>
      </div>
    </article>
  );
}
