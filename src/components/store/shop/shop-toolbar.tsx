import Link from "next/link";
import { t } from "@/content/en";
import { FilterOptions, type FilterOption } from "./filter-options";
import { ShopFilterDrawer } from "./shop-filter-drawer";

/**
 * Wide screens: "All fragrances — 08" on the left, one "Filter" toggle on the right that opens
 * category and price sort together — a native <details> (starts open while a filter is active).
 * Phones: just a filter icon on the right that opens the same choices in a side drawer.
 */
export function ShopToolbar({
  count,
  groups,
  filtered,
}: {
  count: number;
  groups: { label: string; options: FilterOption[] }[];
  filtered: boolean;
}) {
  return (
    <>
      <div className="border-primary/15 flex justify-end border-b py-2 sm:hidden">
        <ShopFilterDrawer groups={groups} filtered={filtered} />
      </div>
      <Desktop count={count} groups={groups} filtered={filtered} />
    </>
  );
}

function Desktop({
  count,
  groups,
  filtered,
}: {
  count: number;
  groups: { label: string; options: FilterOption[] }[];
  filtered: boolean;
}) {
  return (
    <details open={filtered} className="group/filters border-primary/15 hidden border-b sm:block">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
        <span
          className="eyebrow text-primary text-[0.6rem] whitespace-nowrap sm:text-[0.65rem]"
          aria-live="polite"
        >
          {t.shop.allFragrances} <span className="text-primary/50">—</span>{" "}
          <span className="numeric">{String(count).padStart(2, "0")}</span>
        </span>
        <span className="eyebrow text-primary inline-flex items-center gap-3 text-[0.6rem] whitespace-nowrap sm:text-[0.65rem]">
          {t.shop.filter}
          <span aria-hidden className="relative block size-2.5">
            <span className="bg-primary absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
            <span className="bg-primary absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-transform duration-300 group-open/filters:scale-y-0" />
          </span>
        </span>
      </summary>
      <div className="filter-panel grid gap-7 pt-2 pb-7 sm:grid-cols-[auto_auto_1fr] sm:items-end sm:gap-16">
        {groups.map((g) => (
          <FilterOptions key={g.label} label={g.label} options={g.options} />
        ))}
        {filtered ? (
          <Link
            href="/shop"
            scroll={false}
            className="eyebrow text-primary/55 hover:text-primary justify-self-start pb-1 text-[0.6rem] transition-colors sm:justify-self-end"
          >
            {t.shop.clearFilters}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
