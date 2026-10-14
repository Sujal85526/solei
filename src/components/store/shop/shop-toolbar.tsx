import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { t } from "@/content/en";
import { FilterChips, type Chip } from "./filter-chips";

/**
 * "All fragrances — 08" on the left, Filter + Sort on the right. The panel is a native
 * <details>, so it opens without JavaScript (and starts open while filters are active); the
 * choices are plain links (URL search params).
 */
export function ShopToolbar({
  count,
  groups,
  filtered,
}: {
  count: number;
  groups: { label: string; chips: Chip[] }[];
  filtered: boolean;
}) {
  return (
    <details open={filtered} className="group/filters border-primary/15 border-b">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
        <span
          className="eyebrow text-primary text-[0.6rem] whitespace-nowrap sm:text-[0.65rem]"
          aria-live="polite"
        >
          {t.shop.allFragrances} <span className="text-primary/50">—</span>{" "}
          <span className="numeric">{String(count).padStart(2, "0")}</span>
        </span>
        <span className="eyebrow text-primary inline-flex items-center gap-2 text-[0.6rem] whitespace-nowrap sm:text-[0.65rem]">
          <SlidersHorizontal className="hidden size-3.5 sm:block" strokeWidth={1.25} aria-hidden />
          {t.shop.filterSort}
          <span
            aria-hidden
            className="inline-block transition-transform duration-300 group-open/filters:rotate-45"
          >
            +
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-5 pb-6">
        {groups.map((g) => (
          <FilterChips key={g.label} label={g.label} chips={g.chips} />
        ))}
        {filtered ? (
          <Link
            href="/shop"
            scroll={false}
            className="text-primary self-start text-sm underline underline-offset-4"
          >
            {t.shop.clearFilters}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
