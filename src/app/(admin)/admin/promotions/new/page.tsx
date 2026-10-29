import type { Metadata } from "next";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listCodeTargets, listPromotionScope } from "@/modules/coupons/queries";

export const metadata: Metadata = { title: "New promotion" };

export default async function NewPromotionPage() {
  await requirePagePermission("coupons.manage");
  const [scope, targets] = await Promise.all([listPromotionScope(), listCodeTargets()]);
  return (
    <>
      <PageHeader
        title="New promotion"
        description="Name the code, choose what it gives and add any rules you want."
      />
      <div className="max-w-3xl">
        <CouponForm {...scope} targets={targets} />
      </div>
    </>
  );
}
