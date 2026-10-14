import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MovementsList } from "@/components/admin/inventory/movements-list";
import { StockActions } from "@/components/admin/inventory/stock-actions";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  getVariantStock,
  listLocations,
  listMovements,
  variantOptions,
} from "@/modules/inventory/queries";
import { staffDirectory } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Stock history" };

export default async function VariantStockPage({
  params,
}: PageProps<"/admin/inventory/[variantId]">) {
  const staff = await requirePagePermission("inventory.view");
  const { variantId } = await params;
  const [data, locations, variants, movements, people] = await Promise.all([
    getVariantStock(variantId),
    listLocations({ includeInactive: true }),
    variantOptions(),
    listMovements({ variant: variantId }),
    staffDirectory(),
  ]);
  if (!data) notFound();
  const { variant, levels } = data;
  const byLocation = new Map(levels.map((l) => [l.location_id, l.on_hand ?? 0]));
  const total = levels.reduce((s, l) => s + (l.on_hand ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/inventory"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Inventory
      </Link>
      <PageHeader
        title={variant.products?.name ?? variant.sku}
        description={
          <>
            <span className="font-mono">{variant.sku}</span>
            {variant.label ? ` · ${variant.label}` : ""} ·{" "}
            <Link
              href={`/admin/products/${variant.products?.id}`}
              className="underline-offset-4 hover:underline"
            >
              Edit product
            </Link>
          </>
        }
        actions={
          <StockActions
            variants={variants}
            locations={locations.filter((l) => l.active)}
            defaultVariantId={variant.id}
            can={{
              receive: can(staff.permissions, "inventory.receive"),
              adjust: can(staff.permissions, "inventory.adjust"),
              transfer: can(staff.permissions, "inventory.transfer"),
            }}
          />
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total on hand" value={total} />
        {locations
          .filter((l) => byLocation.has(l.id))
          .map((l) => (
            <StatCard key={l.id} label={l.name} value={byLocation.get(l.id)} />
          ))}
      </div>
      <AdminSection title="History" description={`${movements.total} movements`}>
        <MovementsList rows={movements.rows} people={people} showProduct={false} />
      </AdminSection>
    </div>
  );
}
