import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { BusinessExpenses, ExpenseCategories } from "@/components/admin/reports/business-expenses";
import { ReportsTabs } from "@/components/admin/reports/reports-tabs";
import { AdminSection } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { businessExpenses, expenseCategories } from "@/modules/expenses/queries";
import { monthBounds, parseMonth, shiftMonth } from "@/modules/expenses/schema";

export const metadata: Metadata = { title: "Business expenses" };

export default async function BusinessExpensesPage({
  searchParams,
}: PageProps<"/admin/reports/expenses">) {
  const staff = await requirePagePermission("reports.financial.view");
  const sp = await searchParams;
  const today = businessDay();
  const month = parseMonth(sp.month, today);
  const { from, to } = monthBounds(month);
  const [expenses, categories] = await Promise.all([
    businessExpenses(from, to),
    expenseCategories(),
  ]);
  const canManage = can(staff.permissions, "expenses.manage");
  const isThisMonth = month === today.slice(0, 7);
  const title = formatBusinessDate(from, { month: "long", year: "numeric" });

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Rent, salaries, marketing and other costs that don't belong to one event. They come off the business profit & loss."
      />
      <div className="-mt-6 -mb-6">
        <ReportsTabs financial />
      </div>

      <AdminSection
        title={title}
        description={
          canManage
            ? "Enter each cost on the day it was paid. Event costs stay on the event."
            : "Only staff allowed to manage expenses can add or change them."
        }
        actions={
          <nav aria-label="Month" className="flex gap-1">
            <Link
              href={`/admin/reports/expenses?month=${shiftMonth(month, -1)}`}
              className={buttonVariants({ variant: "outline", size: "icon" })}
              aria-label="Previous month"
            >
              <ChevronLeft className="rtl:rotate-180" />
            </Link>
            {!isThisMonth ? (
              <Link
                href="/admin/reports/expenses"
                className={buttonVariants({ variant: "outline" })}
              >
                This month
              </Link>
            ) : null}
            <Link
              href={`/admin/reports/expenses?month=${shiftMonth(month, 1)}`}
              className={buttonVariants({ variant: "outline", size: "icon" })}
              aria-label="Next month"
            >
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </nav>
        }
      >
        <BusinessExpenses
          expenses={expenses}
          categories={categories}
          defaultDate={isThisMonth ? today : from}
          canManage={canManage}
        />
      </AdminSection>

      <AdminSection
        title="Categories"
        description="Rename, add or hide categories. A hidden category stays on old expenses."
        className="lg:max-w-xl"
      >
        <ExpenseCategories categories={categories} canManage={canManage} />
      </AdminSection>
    </div>
  );
}
