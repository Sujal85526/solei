import Link from "next/link";
import type { HomeDestination } from "@/modules/content/queries";

/**
 * Slow, endless ticker of destination names in italic display type — a breath between sections.
 * The list is rendered twice for a seamless loop; the copy is hidden from assistive tech. Still
 * for prefers-reduced-motion; pauses on hover.
 */
export function DestinationTicker({ destinations }: { destinations: HomeDestination[] }) {
  const row = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center">
      {destinations.map((d) => (
        <li key={d.slug} className="flex items-center">
          <Link
            href={`/destinations/${d.slug}`}
            tabIndex={copy ? -1 : undefined}
            className="font-display text-pearl/85 hover:text-pink px-8 text-4xl font-light whitespace-nowrap italic transition-colors sm:px-12 sm:text-6xl"
          >
            {d.name}
          </Link>
          <span aria-hidden className="text-gold/70 text-xl">
            ✦
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section
      aria-label="Destinations"
      className="ticker bg-noir border-pink/10 overflow-hidden border-y py-10 sm:py-14"
    >
      <div className="ticker-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
