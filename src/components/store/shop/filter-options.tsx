import Link from "next/link";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type FilterOption = { label: string; href: string; active: boolean };

/**
 * A labelled group of quiet text options; the chosen one is underlined. Plain links (URL search
 * params) so filtering works without JavaScript. `row` for the desktop panel, `stack` for the
 * phone drawer (where `onSelect` closes it). Colours follow the section theme.
 */
export function FilterOptions({
  label,
  options,
  layout = "row",
  onSelect,
}: {
  label: string;
  options: FilterOption[];
  layout?: "row" | "stack";
  onSelect?: () => void;
}) {
  const id = `filter-${layout}-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-3">
      <p id={id} className="eyebrow text-primary/55 text-[0.6rem]">
        {label}
      </p>
      <ul
        aria-labelledby={id}
        className={layout === "row" ? "flex flex-wrap gap-x-7 gap-y-2" : "flex flex-col gap-1"}
      >
        {options.map((o, i) => (
          <li
            key={o.href}
            className={layout === "stack" ? "drawer-item" : undefined}
            style={{ "--i": i } as CSSProperties}
          >
            <Link
              href={o.href}
              scroll={false}
              onClick={onSelect}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "inline-block border-b pb-1 text-[0.65rem] tracking-[0.24em] uppercase transition-colors duration-300",
                layout === "stack" && "py-2 text-[0.7rem]",
                o.active
                  ? "border-primary text-primary"
                  : "text-primary/55 hover:text-primary border-transparent",
              )}
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
