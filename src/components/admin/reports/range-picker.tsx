import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RANGE_PRESET_LABELS, RANGE_PRESETS, type ReportRange } from "@/modules/reports/range";

/**
 * Date range for a report, without JavaScript: preset pills are links (`?range=`), "Custom" is
 * a GET form with two business days. `keep` carries other query values (e.g. `idle`).
 */
export function RangePicker({
  path,
  range,
  keep = {},
}: {
  path: string;
  range: ReportRange;
  keep?: Record<string, string>;
}) {
  const href = (q: Record<string, string>) => `${path}?${new URLSearchParams({ ...keep, ...q })}`;
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Period" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5">
          {RANGE_PRESETS.filter((p) => p !== "custom").map((p) => (
            <li key={p}>
              <Link
                href={href({ range: p })}
                scroll={false}
                aria-current={range.preset === p ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
                  range.preset === p
                    ? "bg-burgundy border-burgundy text-cream font-medium"
                    : "hover:bg-muted text-foreground",
                )}
                data-testid={`range-${p}`}
              >
                {RANGE_PRESET_LABELS[p]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form
        method="get"
        action={path}
        className="flex flex-wrap items-end gap-3"
        aria-label="Custom dates"
      >
        {Object.entries(keep).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <label className="flex flex-col gap-1.5 text-sm">
          From
          <Input type="date" name="from" defaultValue={range.from} className="h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          To
          <Input type="date" name="to" defaultValue={range.to} className="h-10 w-40" />
        </label>
        <Button
          type="submit"
          variant={range.preset === "custom" ? "default" : "outline"}
          className="h-10"
        >
          {RANGE_PRESET_LABELS.custom} dates
        </Button>
      </form>
    </div>
  );
}
