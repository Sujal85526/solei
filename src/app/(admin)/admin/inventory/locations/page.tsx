import type { Metadata } from "next";
import { InventoryTabs } from "@/components/admin/inventory/inventory-tabs";
import { LocationsEditor } from "@/components/admin/inventory/locations-editor";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listLocations } from "@/modules/inventory/queries";

export const metadata: Metadata = { title: "Stock locations" };

export default async function LocationsPage() {
  const staff = await requirePagePermission("inventory.view");
  const locations = await listLocations({ includeInactive: true });
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Where stock is kept. Each event gets its own location."
      />
      <InventoryTabs />
      <LocationsEditor locations={locations} canEdit={can(staff.permissions, "inventory.adjust")} />
    </>
  );
}
