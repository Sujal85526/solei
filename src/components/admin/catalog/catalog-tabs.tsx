import { SubNav } from "@/components/admin/sub-nav";

export function CatalogTabs() {
  return (
    <SubNav
      items={[
        { href: "/admin/products", label: "Products" },
        { href: "/admin/products/categories", label: "Categories" },
        { href: "/admin/products/destinations", label: "Destinations" },
      ]}
    />
  );
}
