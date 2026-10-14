import { SubNav } from "@/components/admin/sub-nav";

export function InventoryTabs() {
  return (
    <SubNav
      items={[
        { href: "/admin/inventory", label: "Stock" },
        { href: "/admin/inventory/low-stock", label: "Low stock" },
        { href: "/admin/inventory/movements", label: "Movements" },
        { href: "/admin/inventory/locations", label: "Locations" },
      ]}
    />
  );
}
