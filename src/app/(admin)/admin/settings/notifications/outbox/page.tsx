import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationTabs } from "@/components/admin/notifications/owner-email-form";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination, queryString } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { OUTBOX_PAGE_SIZE, listOutbox, listTemplates } from "@/modules/notifications/queries";
import { outboxFiltersSchema } from "@/modules/notifications/schema";

export const metadata: Metadata = { title: "Outbox" };

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const first = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function OutboxPage({
  searchParams,
}: PageProps<"/admin/settings/notifications/outbox">) {
  await requirePagePermission("notifications.manage");
  const sp = await searchParams;
  const filters = outboxFiltersSchema.parse(
    Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, first(v)])),
  );
  const [{ rows, total, page }, templates] = await Promise.all([
    listOutbox(filters),
    listTemplates(),
  ]);
  const names = new Map(templates.map((t) => [t.key, t.name]));
  const pages = Math.max(1, Math.ceil(total / OUTBOX_PAGE_SIZE));

  return (
    <>
      <Link
        href="/admin/settings"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Settings
      </Link>
      <PageHeader
        title="Notifications"
        description="Every email the system sent, skipped or failed to send, newest first."
      />
      <NotificationTabs />
      <form
        method="get"
        className="bg-card mb-5 grid grid-cols-2 gap-2 rounded-xl border p-3 sm:p-4 lg:grid-cols-[1fr_12rem_14rem_auto]"
      >
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Recipient or subject"
          aria-label="Search the outbox"
          className="col-span-2 h-10 lg:col-span-1"
        />
        <NativeSelect name="status" defaultValue={filters.status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          <option value="sent">Sent</option>
          <option value="skipped">Skipped</option>
          <option value="failed">Failed</option>
        </NativeSelect>
        <NativeSelect name="template" defaultValue={filters.template ?? ""} aria-label="Email">
          <option value="">All emails</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
        <div className="col-span-2 flex gap-2 lg:col-span-1">
          <Button type="submit" className="h-10 flex-1">
            Filter
          </Button>
          <Link
            href="/admin/settings/notifications/outbox"
            className={buttonVariants({ variant: "ghost", className: "h-10" })}
          >
            Reset
          </Link>
        </div>
      </form>

      <p className="text-muted-foreground mb-3 text-sm">{total.toLocaleString("en-AE")} emails</p>
      <ol className="bg-card divide-y rounded-xl border">
        {rows.length === 0 ? (
          <li className="text-muted-foreground p-6 text-sm">Nothing here yet.</li>
        ) : null}
        {rows.map((r) => (
          <li
            key={r.id}
            className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8.5rem_1fr_auto] sm:items-center sm:gap-4"
          >
            <time className="numeric text-muted-foreground text-xs" dateTime={r.created_at}>
              {timeFmt.format(new Date(r.created_at))}
            </time>
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {r.subject ?? names.get(r.template_key ?? "") ?? r.template_key}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {names.get(r.template_key ?? "") ?? r.template_key} · {r.recipient}
                {r.orders?.number ? (
                  <>
                    {" · "}
                    <Link
                      href={`/admin/orders/${r.order_id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {r.orders.number}
                    </Link>
                  </>
                ) : null}
                {r.provider ? ` · via ${r.provider}` : ""}
              </span>
              {r.error ? (
                <span className="text-muted-foreground block truncate text-xs">{r.error}</span>
              ) : null}
            </span>
            <Badge
              variant={
                r.status === "sent" ? "success" : r.status === "failed" ? "destructive" : "muted"
              }
              className="justify-self-start sm:justify-self-end"
            >
              {r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Skipped"}
            </Badge>
          </li>
        ))}
      </ol>
      <Pagination
        page={page}
        pages={pages}
        href={(p) => `?${queryString({ ...filters, page: p })}`}
      />
    </>
  );
}
