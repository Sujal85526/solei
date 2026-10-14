import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { emirateLabels, type Emirate } from "@/modules/events/schema";
import type { CalendarEvent } from "@/modules/events/queries";
import { eventHref } from "./event-chip";
import { StatusBadge, TypeLabel } from "./event-style";

export function formatEventDates(start: string, end: string) {
  if (start === end)
    return formatBusinessDate(start, { weekday: "short", day: "numeric", month: "short" });
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = formatBusinessDate(
    start,
    sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" },
  );
  return `${from} – ${formatBusinessDate(end, { day: "numeric", month: "short" })}`;
}

/** Tappable event row (list view, selected day on phones). */
export function EventCard({ event, today }: { event: CalendarEvent; today: string }) {
  const live = event.start_date <= today && event.end_date >= today && event.status !== "cancelled";
  const place = [event.location, event.emirate ? emirateLabels[event.emirate as Emirate] : null]
    .filter(Boolean)
    .join(", ");
  return (
    <Link
      href={eventHref(event.id)}
      data-testid="event-card"
      className={cn(
        "bg-card hover:border-burgundy/40 flex items-center gap-3 rounded-xl border p-3 transition-colors sm:p-4",
        event.type === "private_booking" && "border-s-gold border-s-4",
      )}
    >
      <div
        className={cn(
          "flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5 text-center",
          event.status === "confirmed" ? "bg-burgundy text-cream" : "bg-muted text-burgundy",
        )}
        aria-hidden
      >
        <span className="text-[0.65rem] font-medium tracking-wide uppercase">
          {formatBusinessDate(event.start_date, { month: "short" })}
        </span>
        <span className="font-display text-xl leading-none">
          {formatBusinessDate(event.start_date, { day: "numeric" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-foreground truncate font-medium",
            event.status === "cancelled" && "text-muted-foreground line-through",
          )}
        >
          {event.name}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {formatEventDates(event.start_date, event.end_date)}
          {live ? <span className="text-burgundy ms-2 text-xs font-semibold">● Today</span> : null}
        </p>
        {place ? (
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-xs">
            <MapPin className="size-3 shrink-0" aria-hidden /> {place}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} className="h-5 px-2 text-[0.7rem]" />
          <TypeLabel type={event.type} />
        </div>
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
