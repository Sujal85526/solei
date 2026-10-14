import { CalendarDays } from "lucide-react";
import { formatBusinessDate } from "@/lib/dates";
import { groupByStartMonth } from "@/modules/events/calendar";
import type { CalendarEvent } from "@/modules/events/queries";
import { EventCard } from "./event-card";

export function ListView({
  events,
  today,
  emptyHint,
}: {
  events: CalendarEvent[];
  today: string;
  emptyHint?: string;
}) {
  if (!events.length)
    return (
      <div className="bg-card text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm">
        <CalendarDays className="size-6" strokeWidth={1.5} aria-hidden />
        <p>No events in this period.</p>
        {emptyHint ? <p className="text-xs">{emptyHint}</p> : null}
      </div>
    );
  return (
    <div className="flex flex-col gap-6">
      {groupByStartMonth(events).map((g) => (
        <section
          key={g.month}
          aria-label={formatBusinessDate(`${g.month}-15`, { month: "long", year: "numeric" })}
        >
          <h2 className="text-muted-foreground mb-2 font-sans text-xs font-semibold tracking-wide uppercase">
            {formatBusinessDate(`${g.month}-15`, { month: "long", year: "numeric" })}
          </h2>
          <ul className="flex flex-col gap-2">
            {g.events.map((e) => (
              <li key={e.id}>
                <EventCard event={e} today={today} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
