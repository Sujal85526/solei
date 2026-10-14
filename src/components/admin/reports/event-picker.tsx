import Link from "next/link";
import { ChevronRight, GitCompareArrows } from "lucide-react";
import { formatEventDates } from "@/components/admin/events/event-card";
import { StatusBadge, TypeLabel } from "@/components/admin/events/event-style";
import { Button } from "@/components/ui/button";
import type { ReportEventOption } from "@/modules/reports/queries";
import { MAX_COMPARE, MIN_COMPARE } from "@/modules/reports/params";

/**
 * Event list for reports: tap a name to open its report, tick 2–6 to compare. A plain GET form
 * (works before hydration and on flaky exhibition Wi-Fi).
 */
export function EventPicker({
  options,
  selected = [],
  submitLabel = "Compare selected",
}: {
  options: ReportEventOption[];
  selected?: string[];
  submitLabel?: string;
}) {
  if (!options.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No events yet. Create one in the{" "}
        <Link href="/admin/calendar" className="text-burgundy underline-offset-4 hover:underline">
          calendar
        </Link>
        ; its POS sales will be reported here.
      </p>
    );
  }
  return (
    <form method="get" action="/admin/reports/events/compare" className="flex flex-col gap-4">
      <ul
        className="-mx-5 divide-y border-y sm:mx-0 sm:rounded-lg sm:border"
        data-testid="report-events"
      >
        {options.map((e) => (
          <li key={e.id} className="flex items-center gap-1 ps-5 pe-2 sm:ps-3">
            <label className="-ms-2 grid size-11 shrink-0 cursor-pointer place-items-center">
              <input
                type="checkbox"
                name="ids"
                value={e.id}
                defaultChecked={selected.includes(e.id)}
                className="accent-burgundy size-4.5"
                aria-label={`Compare ${e.name}`}
              />
            </label>
            <Link
              href={`/admin/reports/events/${e.id}`}
              className="hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.name}</span>
                <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span>
                    {formatEventDates(e.start_date, e.end_date)} {e.start_date.slice(0, 4)}
                  </span>
                  <TypeLabel type={e.type} />
                  <StatusBadge status={e.status} />
                </span>
              </span>
              <span className="numeric text-muted-foreground shrink-0 text-end text-xs">
                <span className="text-foreground block text-sm font-semibold">
                  {e.units.toLocaleString("en-AE")}
                </span>
                units
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" className="h-11" data-testid="compare-submit">
          <GitCompareArrows /> {submitLabel}
        </Button>
        <p className="text-muted-foreground text-xs">
          Tick {MIN_COMPARE}–{MAX_COMPARE} events to compare them side by side.
        </p>
      </div>
    </form>
  );
}
