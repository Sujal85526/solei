import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PromoStateBadge, promoState } from "@/components/admin/promotions/promo-state-badge";
import { PromotionsTabs } from "@/components/admin/promotions/promotions-tabs";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { listOffers } from "@/modules/promotions/queries";
import {
  CHANNEL_LABELS,
  OFFER_KIND_LABELS,
  offerValueLabel,
  type Offer,
} from "@/modules/promotions/schema";

export const metadata: Metadata = { title: "Offers" };

const datesLabel = (o: Pick<Offer, "startsOn" | "endsOn">) =>
  o.startsOn && o.endsOn
    ? `${formatBusinessDate(o.startsOn)} – ${formatBusinessDate(o.endsOn)}`
    : o.startsOn
      ? `from ${formatBusinessDate(o.startsOn)}`
      : o.endsOn
        ? `until ${formatBusinessDate(o.endsOn)}`
        : null;

export default async function OffersPage() {
  await requirePagePermission("coupons.manage");
  const offers = await listOffers();
  return (
    <>
      <PageHeader
        title="Promotions"
        description="Offers apply automatically, no code needed. Each item counts towards one offer only; codes come after offers."
        actions={
          <Link href="/admin/promotions/offers/new" className={buttonVariants()}>
            <Plus className="size-4" /> New offer
          </Link>
        }
      />
      <PromotionsTabs />
      {offers.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <p className="font-medium">No offers yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create one — e.g. 15% off all sprays, a perfume + spray set for AED 450, or buy 2 get 1
            free.
          </p>
        </div>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {offers.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/promotions/offers/${o.id}`}
                className="hover:bg-muted/50 flex items-center gap-4 px-5 py-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-sm">{offerValueLabel(o)}</span>
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[
                      OFFER_KIND_LABELS[o.kind],
                      o.channels.map((c) => CHANNEL_LABELS[c]).join(" + "),
                      datesLabel(o),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <PromoStateBadge state={promoState(o)} />
                <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
