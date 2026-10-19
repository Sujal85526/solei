import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { CouponStateBadge } from "@/components/admin/coupons/coupon-state-badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { listCoupons } from "@/modules/coupons/queries";
import { couponState, couponValueLabel } from "@/modules/coupons/schema";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requirePagePermission("coupons.manage");
  const coupons = await listCoupons();
  return (
    <>
      <PageHeader
        title="Coupons"
        description="Discount codes customers can enter at checkout on the website."
        actions={
          <Link href="/admin/coupons/new" className={buttonVariants()}>
            <Plus className="size-4" /> New coupon
          </Link>
        }
      />
      {coupons.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <p className="font-medium">No coupons yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Create one — e.g. <span className="font-mono">WELCOME10</span> for 10% off a first
            order.
          </p>
        </div>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {coupons.map((c) => {
            const rules = [
              c.endsOn ? `until ${formatBusinessDate(c.endsOn)}` : null,
              c.minOrderFils ? `min ${formatAED(c.minOrderFils)}` : null,
              c.oncePerCustomer ? "once per customer" : null,
              c.productIds.length
                ? `${c.productIds.length} product${c.productIds.length === 1 ? "" : "s"}`
                : null,
            ].filter(Boolean);
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/coupons/${c.id}`}
                  className="hover:bg-muted/50 flex items-center gap-4 px-5 py-4 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-medium">{c.code}</span>
                      <span className="text-sm">{couponValueLabel(c)}</span>
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {[c.description, ...rules].filter(Boolean).join(" · ") || "No limits"}
                    </span>
                  </span>
                  <span className="text-muted-foreground hidden text-end text-xs sm:block">
                    <span className="numeric text-foreground block text-sm">
                      {c.uses}
                      {c.maxUses ? ` / ${c.maxUses}` : ""} used
                    </span>
                    {c.discountFils ? `${formatAED(c.discountFils)} given` : null}
                  </span>
                  <CouponStateBadge state={couponState(c, c.uses)} />
                  <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
