import type { Metadata } from "next";
import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { StockActions } from "@/components/admin/inventory/stock-actions";
import { StockTable } from "@/components/admin/inventory/stock-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { stockMatrix, variantOptions } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const staff = await requirePagePermission("inventory.view");
  const [{ rows, locations }, variants] = await Promise.all([stockMatrix(), variantOptions()]);
  const active = rows.filter((r) => r.active);
  const units = active.reduce((s, r) => s + r.total, 0);
  const atEvents = active.reduce(
    (s, r) =>
      s +
      locations
        .filter((l) => l.kind === "event")
        .reduce((n, l) => n + (r.byLocation[l.id] ?? 0), 0),
    0,
  );
  const low = active.filter((r) => r.low).length;
  const shownLocations = locations.filter(
    (l) => l.kind !== "event" || rows.some((r) => r.byLocation[l.id]),
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock is calculated from every movement — sales, deliveries, transfers and corrections."
        actions={
          <StockActions
            variants={variants}
            locations={locations}
            can={{
              receive: can(staff.permissions, "inventory.receive"),
              adjust: can(staff.permissions, "inventory.adjust"),
              transfer: can(staff.permissions, "inventory.transfer"),
            }}
          />
        }
      />
      <InventoryTabs />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Units in stock"
          value={units.toLocaleString("en-AE")}
          hint="Warehouses, excl. events"
        />
        <StatCard label="At events" value={atEvents.toLocaleString("en-AE")} />
        <StatCard
          label="Low stock"
          value={low}
          tone={low ? "warn" : undefined}
          hint="At or below alert level"
        />
        <StatCard label="Products" value={active.length} hint="Active variants" />
      </div>
      <StockTable rows={rows} locations={shownLocations} />
    </>
  );
}
