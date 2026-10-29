import type { Metadata } from "next";
import Link from "next/link";
import { CustomersNav } from "@/components/admin/customers/customers-nav";
import { FeedbackDialog, FeedbackList } from "@/components/admin/customers/feedback";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  FEEDBACK_PAGE_SIZE,
  assignableStaff,
  feedbackCounts,
  listFeedback,
} from "@/modules/feedback/queries";
import {
  feedbackFiltersToQuery,
  feedbackKinds,
  feedbackStatuses,
  kindLabels,
  parseFeedbackFilters,
  statusLabels,
} from "@/modules/feedback/schema";

export const metadata: Metadata = { title: "Complaints & suggestions" };

/** The complaints, suggestions and compliments log, with what was done about each. */
export default async function FeedbackPage({
  searchParams,
}: PageProps<"/admin/customers/feedback">) {
  const staff = await requirePagePermission("customers.view");
  const filters = parseFeedbackFilters(await searchParams);
  const canManage = can(staff.permissions, "customers.manage");
  const [{ rows, total }, counts, people] = await Promise.all([
    listFeedback(filters),
    feedbackCounts(),
    assignableStaff(),
  ]);
  const pages = Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE));
  const filtered = Boolean(filters.status || filters.kind || filters.assigned);

  return (
    <>
      <PageHeader
        title="Complaints & suggestions"
        description="What customers told you — in person, by phone, WhatsApp or the feedback email — and what was done about it."
        actions={canManage ? <FeedbackDialog staff={people} /> : null}
      />
      <CustomersNav canSettings={can(staff.permissions, "settings.manage")} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open" value={counts.open} />
        <StatCard label="In progress" value={counts.inProgress} />
      </div>

      <form
        method="get"
        aria-label="Filter feedback"
        className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_12rem_auto]"
      >
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {feedbackStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="kind" defaultValue={filters.kind ?? ""} aria-label="Kind">
          <option value="">Any kind</option>
          {feedbackKinds.map((k) => (
            <option key={k} value={k}>
              {kindLabels[k]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="assigned" defaultValue={filters.assigned ?? ""} aria-label="Handled by">
          <option value="">Anyone</option>
          <option value="me">Mine</option>
          {people
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Show
          </Button>
          {filtered ? (
            <Link href="/admin/customers/feedback" className={buttonVariants({ variant: "ghost" })}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <AdminSection title={total === 1 ? "1 entry" : `${total.toLocaleString("en-AE")} entries`}>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {filtered ? "Nothing matches these filters." : "Nothing logged yet."}
          </p>
        ) : (
          <FeedbackList entries={rows} staff={people} canManage={canManage} showCustomer />
        )}
      </AdminSection>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Link
            href={`?${feedbackFiltersToQuery(filters, filters.page - 1)}`}
            aria-disabled={filters.page <= 1}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              filters.page <= 1 && "pointer-events-none opacity-50",
            )}
          >
            Previous
          </Link>
          <span className="text-muted-foreground">
            Page {filters.page} of {pages}
          </span>
          <Link
            href={`?${feedbackFiltersToQuery(filters, filters.page + 1)}`}
            aria-disabled={filters.page >= pages}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              filters.page >= pages && "pointer-events-none opacity-50",
            )}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </>
  );
}
