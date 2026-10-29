import { SubNav } from "@/components/admin/sub-nav";

/** Tabs: hours clocked, the planned rota, and (with reports.view) the staff report. */
export function AttendanceNav({ canReport }: { canReport: boolean }) {
  return (
    <SubNav
      items={[
        { href: "/admin/attendance", label: "Hours" },
        { href: "/admin/attendance/rota", label: "Rota" },
        ...(canReport ? [{ href: "/admin/reports/staff", label: "Staff report" }] : []),
      ]}
    />
  );
}
