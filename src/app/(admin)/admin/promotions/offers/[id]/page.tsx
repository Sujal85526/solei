import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { OfferActions } from "@/components/admin/promotions/offer-actions";
import { OfferForm } from "@/components/admin/promotions/offer-form";
import { PromoStateBadge, promoState } from "@/components/admin/promotions/promo-state-badge";
import { requirePagePermission } from "@/lib/auth/session";
import { listPromotionScope } from "@/modules/coupons/queries";
import { getOffer } from "@/modules/promotions/queries";
import { OFFER_KIND_LABELS, offerValueLabel } from "@/modules/promotions/schema";

export const metadata: Metadata = { title: "Offer" };

export default async function OfferPage({ params }: PageProps<"/admin/promotions/offers/[id]">) {
  await requirePagePermission("coupons.manage");
  const { id } = await params;
  const [offer, scope] = await Promise.all([getOffer(id), listPromotionScope()]);
  if (!offer) notFound();
  return (
    <>
      <PageHeader
        title={offer.name}
        description={
          <>
            <Link href="/admin/promotions/offers" className="underline underline-offset-4">
              Offers
            </Link>{" "}
            · {offerValueLabel(offer)}
          </>
        }
        actions={<OfferActions id={offer.id} name={offer.name} active={offer.active} />}
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <OfferForm offer={offer} {...scope} />
        <aside className="bg-card flex flex-col gap-4 rounded-xl border p-5 text-sm lg:order-last">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <PromoStateBadge state={promoState(offer)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Kind</span>
            <span>{OFFER_KIND_LABELS[offer.kind]}</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Offers apply automatically, no code needed. Each item counts towards one offer only;
            codes come after offers.
          </p>
        </aside>
      </div>
    </>
  );
}
