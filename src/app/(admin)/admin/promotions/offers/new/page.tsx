import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { OfferForm } from "@/components/admin/promotions/offer-form";
import { requirePagePermission } from "@/lib/auth/session";
import { listPromotionScope } from "@/modules/coupons/queries";

export const metadata: Metadata = { title: "New offer" };

export default async function NewOfferPage() {
  await requirePagePermission("coupons.manage");
  const scope = await listPromotionScope();
  return (
    <>
      <PageHeader
        title="New offer"
        description="Choose the kind of offer, what it gives and where it applies. It works automatically — no code needed."
      />
      <div className="max-w-3xl">
        <OfferForm {...scope} />
      </div>
    </>
  );
}
