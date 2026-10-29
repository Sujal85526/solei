import type { Metadata } from "next";
import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { StockActions } from "@/components/admin/inventory/stock-actions";
import { StockTable } from "@/components/admin/inventory/stock-table";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { stockMatrix, variantOptions } from "@/modules/inventory/queries";
import { inventoryValue } from "@/modules/reports/business";
import { variantCosts } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const staff = await requirePagePermission("inventory.view");
  const financial = can(staff.permissions, "reports.financial.view");
  const [{ rows, locations }, variants, costs] = await Promise.all([
    stockMatrix(),
    variantOptions(),
    financial ? variantCosts() : null,
  ]);
  // Stock value (financial only): units on hand at every location, events included, × unit cost.
  const onHand = (r: (typeof rows)[number]) =>
    Object.values(r.byLocation).reduce((s, n) => s + n, 0);
  const value = costs
    ? inventoryValue(
        rows.map((r) => ({ on_hand: onHand(r), cost_fils: costs.get(r.variantId) ?? 0 })),
        true,
      )
    : null;
  const values = costs
    ? Object.fromEntries(
        rows.map((r) => [r.variantId, Math.max(0, onHand(r)) * (costs.get(r.variantId) ?? 0)]),
      )
    : undefined;
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
      <div
        className={cn("mb-6 grid grid-cols-2 gap-3", value ? "lg:grid-cols-5" : "lg:grid-cols-4")}
      >
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
        {value ? (
          <div className="col-span-2 lg:col-span-1">
            <StatCard
              label="Stock value"
              value={formatAED(value.valueFils ?? 0)}
              hint={
                value.variantsWithoutCost
                  ? `At cost, all locations · ${value.variantsWithoutCost} without a cost`
                  : "At cost, all locations"
              }
            />
          </div>
        ) : null}
      </div>
      <StockTable rows={rows} locations={shownLocations} values={values} />
    </>
  );
}
