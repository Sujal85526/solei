import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterOption = { label: string; href: string; active: boolean };

/**
 * A labelled row of quiet text options; the chosen one is underlined. Plain links (URL search
 * params) so filtering works without JavaScript. Colours follow the section theme.
 */
export function FilterOptions({ label, options }: { label: string; options: FilterOption[] }) {
  const id = `filter-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-3">
      <p id={id} className="eyebrow text-primary/55 text-[0.6rem]">
        {label}
      </p>
      <ul aria-labelledby={id} className="flex flex-wrap gap-x-7 gap-y-2">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "inline-block border-b pb-1 text-[0.65rem] tracking-[0.24em] uppercase transition-colors duration-300",
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
