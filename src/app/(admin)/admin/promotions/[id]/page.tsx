import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CouponActions } from "@/components/admin/coupons/coupon-actions";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { CouponStateBadge } from "@/components/admin/coupons/coupon-state-badge";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { getCoupon, listCodeTargets, listPromotionScope } from "@/modules/coupons/queries";
import { couponState, couponValueLabel } from "@/modules/coupons/schema";

export const metadata: Metadata = { title: "Promotion" };

export default async function PromotionPage({ params }: PageProps<"/admin/promotions/[id]">) {
  await requirePagePermission("coupons.manage");
  const { id } = await params;
  const [coupon, scope, targets] = await Promise.all([
    getCoupon(id),
    listPromotionScope(),
    listCodeTargets(),
  ]);
  if (!coupon) notFound();
  return (
    <>
      <PageHeader
        title={coupon.code}
        description={
          <>
            <Link href="/admin/promotions" className="underline underline-offset-4">
              Promotions
            </Link>{" "}
            · {couponValueLabel(coupon)}
          </>
        }
        actions={
          <CouponActions
            id={coupon.id}
            code={coupon.code}
            active={coupon.active}
            uses={coupon.uses}
          />
        }
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <CouponForm coupon={coupon} {...scope} targets={targets} />
        <aside className="bg-card flex flex-col gap-4 rounded-xl border p-5 text-sm lg:order-last">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <CouponStateBadge state={couponState(coupon, coupon.uses)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Used on</span>
            <span className="numeric">
              {coupon.uses}
              {coupon.maxUses ? ` of ${coupon.maxUses}` : ""} order{coupon.uses === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Discount given</span>
            <span className="numeric">{formatAED(coupon.discountFils)}</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Counts paid and in-progress orders (free delivery counts the fee waived); cancelled
            orders and checkouts left unpaid for 2 hours give the use back.
          </p>
        </aside>
      </div>
    </>
  );
}
