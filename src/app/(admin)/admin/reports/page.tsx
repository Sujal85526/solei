import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { EventPicker } from "@/components/admin/reports/event-picker";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { reportEventOptions } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const staff = await requirePagePermission("reports.view");
  const options = await reportEventOptions();
  const financial = can(staff.permissions, "reports.financial.view");

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Reports"
        description={
          financial
            ? "Sales, stock, costs and profit per event — per day and in total."
            : "Sales and stock per event — per day and in total."
        }
      />
      <AdminSection
        title="Events"
        description="Open an event's report, or tick a few to compare them. Exports to Excel and CSV."
      >
        <EventPicker options={options} />
      </AdminSection>
    </div>
  );
}
