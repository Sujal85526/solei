import { cn } from "@/lib/utils";
import { movementTypeLabels } from "@/modules/inventory/schema";
import type { listMovements } from "@/modules/inventory/queries";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

type Row = Awaited<ReturnType<typeof listMovements>>["rows"][number];

export function MovementsList({
  rows,
  people,
  showProduct = true,
}: {
  rows: Row[];
  people: Map<string, string>;
  showProduct?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        No movements yet.
      </p>
    );
  return (
    <ol className="bg-card divide-y rounded-xl border">
      {rows.map((m) => (
        <li
          key={m.id}
          className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 text-sm sm:grid-cols-[8.5rem_1fr_9rem_5rem] sm:items-center"
        >
          <time
            className="numeric text-muted-foreground order-3 text-xs sm:order-none"
            dateTime={m.created_at}
          >
            {timeFmt.format(new Date(m.created_at))}
          </time>
          <span className="min-w-0">
            <span className="font-medium">{movementTypeLabels[m.type]}</span>
            {showProduct ? (
              <span className="text-muted-foreground"> · {m.product_variants?.products?.name}</span>
            ) : null}
            <span className="text-muted-foreground block truncate text-xs">
              {m.stock_locations?.name}
              {m.reason ? ` — ${m.reason}` : ""}
              {m.created_by ? ` · ${people.get(m.created_by) ?? "Staff"}` : ""}
            </span>
          </span>
          <span className="text-muted-foreground order-4 hidden text-xs sm:order-none sm:block">
            {m.product_variants?.sku}
          </span>
          <span
            className={cn(
              "numeric row-span-2 self-center text-end text-base font-semibold sm:row-span-1",
              m.qty > 0 ? "text-success" : "text-destructive",
            )}
          >
            {m.qty > 0 ? `+${m.qty}` : m.qty}
          </span>
        </li>
      ))}
    </ol>
  );
}
