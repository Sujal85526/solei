import Link from "next/link";
import { cn } from "@/lib/utils";

export type Chip = { label: string; href: string; active: boolean; count?: number };

/**
 * A labelled row of filter links. Plain links (URL search params) so filtering works without
 * JavaScript; scrolls horizontally on small screens.
 */
export function FilterChips({ label, chips }: { label: string; chips: Chip[] }) {
  const id = `filter-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <p id={id} className="eyebrow text-gold-ink w-28 shrink-0 text-[0.65rem]">
        {label}
      </p>
      <ul
        aria-labelledby={id}
        className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((c) => (
          <li key={c.href} className="shrink-0">
            <Link
              href={c.href}
              scroll={false}
              aria-current={c.active ? "true" : undefined}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[0.7rem] tracking-[0.2em] whitespace-nowrap uppercase transition-colors duration-300",
                c.active
                  ? "border-burgundy bg-burgundy text-cream"
                  : "border-burgundy/20 text-burgundy hover:border-burgundy/60 bg-transparent",
              )}
            >
              {c.label}
              {c.count !== undefined ? (
                <span className={cn("numeric", c.active ? "text-pink" : "text-ink-muted")}>
                  {c.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
