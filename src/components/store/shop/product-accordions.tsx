import type { ReactNode } from "react";

/**
 * Hairline-separated disclosure rows ("Fragrance notes  +"). Native <details>, so they open
 * without JavaScript; the + turns into a − when open.
 */
export function ProductAccordions({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <div className="border-primary/20 border-b">
      {items.map((item) => (
        <details key={item.title} className="group/acc border-primary/20 border-t">
          <summary className="text-primary flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
            <span className="eyebrow text-[0.62rem]">{item.title}</span>
            <span aria-hidden className="relative block size-2.5">
              <span className="bg-primary absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
              <span className="bg-primary absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-transform duration-300 group-open/acc:scale-y-0" />
            </span>
          </summary>
          <div className="text-foreground/80 pb-5 text-sm leading-relaxed">{item.body}</div>
        </details>
      ))}
    </div>
  );
}
