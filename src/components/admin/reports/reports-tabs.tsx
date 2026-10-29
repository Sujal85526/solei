import { SubNav } from "@/components/admin/sub-nav";

/** Admin → Reports sections. Expenses only for staff who can see financial figures. */
export function ReportsTabs({ financial }: { financial: boolean }) {
  return (
    <SubNav
      items={[
        { href: "/admin/reports/business", label: "Business" },
        { href: "/admin/reports", label: "Events & promotions" },
        { href: "/admin/reports/staff", label: "Staff" },
        ...(financial ? [{ href: "/admin/reports/expenses", label: "Expenses" }] : []),
      ]}
    />
  );
}
