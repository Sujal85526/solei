import { SubNav } from "@/components/admin/sub-nav";

/** Tabs across the customer pages; "Labels & emails" only for staff who change settings. */
export function CustomersNav({ canSettings }: { canSettings: boolean }) {
  return (
    <SubNav
      items={[
        { href: "/admin/customers", label: "Customers" },
        { href: "/admin/customers/feedback", label: "Complaints & suggestions" },
        ...(canSettings ? [{ href: "/admin/customers/settings", label: "Labels & emails" }] : []),
      ]}
    />
  );
}
