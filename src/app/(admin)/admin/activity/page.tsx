import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { AUDIT_PAGE_SIZE, listAudit, staffDirectory } from "@/modules/staff/queries";

export const metadata: Metadata = { title: "Activity" };

const ACTION_FILTERS = [
  { value: "", label: "All activity" },
  { value: "auth.", label: "Sign-ins & security" },
  { value: "orders.", label: "Orders" },
  { value: "payments.", label: "Payments" },
  { value: "stock.", label: "Stock" },
  { value: "product", label: "Products & prices" },
  { value: "customers.", label: "Customers" },
  { value: "events.", label: "Events" },
  { value: "staff_profiles.", label: "Staff" },
  { value: "role", label: "Roles & permissions" },
  { value: "settings.", label: "Settings" },
];

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function str(v: string | string[] | undefined) {
  return typeof v === "string" && v ? v : undefined;
}

/** Short human summary of what changed. */
function describe(before: unknown, after: unknown): string {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  if (!before && after) {
    const name = a.name ?? a.full_name ?? a.number ?? a.sku ?? a.email;
    return name ? String(name) : "";
  }
  if (before && !after) return "deleted";
  const changed = Object.keys(a).filter(
    (k) =>
      !["updated_at", "updated_by"].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  return changed
    .slice(0, 3)
    .map((k) => `${k}: ${fmt(b[k])} → ${fmt(a[k])}`)
    .join(" · ");
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requirePagePermission("audit.view");
  const sp = await searchParams;
  const filters = {
    actor: str(sp.actor),
    action: str(sp.action),
    from: str(sp.from),
    to: str(sp.to),
    page: Number(str(sp.page) ?? 1) || 1,
  };
  const [{ rows, total, page }, people] = await Promise.all([listAudit(filters), staffDirectory()]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const qs = (p: number) =>
    new URLSearchParams(
      Object.entries({ ...filters, page: String(p) }).filter(([, v]) => v) as [string, string][],
    ).toString();

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every change and sign-in, newest first. Times in Abu Dhabi."
      />
      <form
        className="bg-card mb-6 grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5"
        method="get"
      >
        <NativeSelect name="actor" defaultValue={filters.actor ?? ""} aria-label="Person">
          <option value="">Everyone</option>
          {[...people].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="action" defaultValue={filters.action ?? ""} aria-label="Type">
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={filters.from} aria-label="From date" />
        <Input type="date" name="to" defaultValue={filters.to} aria-label="To date" />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Filter
          </Button>
          <Link href="/admin/activity" className={buttonVariants({ variant: "ghost" })}>
            Reset
          </Link>
        </div>
      </form>

      <p className="text-muted-foreground mb-3 text-sm">{total.toLocaleString("en-AE")} entries</p>
      <ol className="bg-card divide-y rounded-xl border">
        {rows.length === 0 ? (
          <li className="text-muted-foreground p-6 text-sm">No activity matches these filters.</li>
        ) : null}
        {rows.map((r) => {
          const who = r.actor_id ? (people.get(r.actor_id) ?? "Unknown user") : "System / visitor";
          const detail = describe(r.before, r.after);
          return (
            <li
              key={r.id}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[9rem_10rem_1fr] sm:gap-4 sm:px-5"
            >
              <time className="numeric text-muted-foreground" dateTime={r.created_at}>
                {timeFmt.format(new Date(r.created_at))}
              </time>
              <span className="font-medium">{who}</span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "bg-muted me-2 rounded px-1.5 py-0.5 font-mono text-xs",
                    r.action.includes("failed") && "bg-destructive/10 text-destructive",
                  )}
                >
                  {r.action}
                </span>
                <span className="text-muted-foreground break-words">{detail}</span>
                {r.ip ? (
                  <span className="text-muted-foreground/70 ms-2 text-xs">{String(r.ip)}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <Link
            aria-disabled={page <= 1}
            href={`?${qs(page - 1)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page <= 1 && "pointer-events-none opacity-50",
            )}
          >
            Newer
          </Link>
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Link
            aria-disabled={page >= pages}
            href={`?${qs(page + 1)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              page >= pages && "pointer-events-none opacity-50",
            )}
          >
            Older
          </Link>
        </nav>
      ) : null}
    </>
  );
}
