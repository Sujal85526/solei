import type { Metadata } from "next";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listCouponProducts } from "@/modules/coupons/queries";

export const metadata: Metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  await requirePagePermission("coupons.manage");
  const products = await listCouponProducts();
  return (
    <>
      <PageHeader
        title="New coupon"
        description="Name the code, choose the discount and add any rules you want."
      />
      <div className="max-w-3xl">
        <CouponForm products={products} />
      </div>
    </>
  );
}
