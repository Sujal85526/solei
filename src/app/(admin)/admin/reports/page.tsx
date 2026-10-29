import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { EventPicker } from "@/components/admin/reports/event-picker";
import { PromotionReport } from "@/components/admin/reports/promotion-report";
import { ExportButtons } from "@/components/admin/reports/report-parts";
import { ReportsTabs } from "@/components/admin/reports/reports-tabs";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { promotionPerformance } from "@/modules/promotions/queries";
import { reportEventOptions } from "@/modules/reports/queries";

export const metadata: Metadata = { title: "Reports" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const staff = await requirePagePermission("reports.view");
  const sp = await searchParams;
  // Promotions: this month so far unless days are picked.
  const today = businessDay();
  const pick = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
  let from = pick(sp.from) ?? `${today.slice(0, 8)}01`;
  let to = pick(sp.to) ?? today;
  if (from > to) [from, to] = [to, from];
  const [options, promotions] = await Promise.all([
    reportEventOptions(),
    promotionPerformance(from, to),
  ]);
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
      <div className="-mt-6 -mb-6">
        <ReportsTabs financial={financial} />
      </div>
      <AdminSection
        title="Events"
        description="Open an event's report, or tick a few to compare them. Exports to Excel and CSV."
      >
        <EventPicker options={options} />
      </AdminSection>
      <AdminSection
        title="Promotions"
        description="Paid website orders that used a discount code, and what each code gave away."
        actions={
          <ExportButtons
            href={`/admin/reports/promotions/export?${new URLSearchParams({ from, to })}`}
          />
        }
      >
        <PromotionReport
          from={from}
          to={to}
          rows={promotions}
          canOpen={can(staff.permissions, "coupons.manage")}
        />
      </AdminSection>
    </div>
  );
}
