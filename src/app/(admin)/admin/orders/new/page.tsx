import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ManualOrderForm } from "@/components/admin/orders/manual-order-form";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { listGiveaways } from "@/modules/giveaways/queries";
import { deliveryZones, sellableVariants } from "@/modules/orders/manual-queries";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const staff = await requirePagePermission("orders.create");
  const supabase = await createClient();
  const [variants, zones, settings, giveaways] = await Promise.all([
    sellableVariants(),
    deliveryZones(),
    supabase.from("settings").select("vat_rate_bp, prices_include_vat").single(),
    listGiveaways(),
  ]);
  return (
    <>
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Orders
      </Link>
      <PageHeader
        title="New order"
        description="Record a WhatsApp or direct sale. Stock is deducted when you create it."
      />
      <ManualOrderForm
        variants={variants}
        zones={zones}
        vatRateBp={settings.data?.vat_rate_bp ?? 500}
        pricesIncludeVat={settings.data?.prices_include_vat ?? true}
        canOverride={can(staff.permissions, "orders.price_override")}
        canRecordPayment={can(staff.permissions, "payments.record")}
        giveaways={giveaways}
      />
    </>
  );
}
