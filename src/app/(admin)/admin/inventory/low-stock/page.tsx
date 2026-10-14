import type { Metadata } from "next";
import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { StockTable } from "@/components/admin/inventory/stock-table";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { stockMatrix } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Low stock" };

export default async function LowStockPage() {
  await requirePagePermission("inventory.view");
  const { rows, locations, defaultThreshold } = await stockMatrix();
  const low = rows.filter((r) => r.low);
  return (
    <>
      <PageHeader
        title="Inventory"
        description={`Products at or below their alert level (default ${defaultThreshold}, editable per variant and in Settings).`}
      />
      <InventoryTabs />
      {low.length ? (
        <StockTable rows={low} locations={locations.filter((l) => l.kind !== "event")} />
      ) : (
        <p className="bg-card text-muted-foreground rounded-xl border p-8 text-center text-sm">
          Nothing is running low. ✨
        </p>
      )}
    </>
  );
}
