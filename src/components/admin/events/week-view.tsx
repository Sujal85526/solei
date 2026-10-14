import Link from "next/link";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { daysBetween, eventsOnDay } from "@/modules/events/calendar";
import { eventStatusLabels, parseDailyHours } from "@/modules/events/schema";
import type { CalendarEvent } from "@/modules/events/queries";
import { eventHref } from "./event-chip";
import { TypeIcon, statusChip } from "./event-style";

/** Seven day columns on tablet/desktop; stacked days on phones. */
export function WeekView({
  days,
  events,
  today,
}: {
  days: string[];
  events: CalendarEvent[];
  today: string;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-7 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border">
      {days.map((day) => {
        const list = eventsOnDay(events, day);
        const isToday = day === today;
        return (
          <li
            key={day}
            data-day={day}
            className={cn(
              "bg-card flex flex-col rounded-xl border sm:min-h-64 sm:rounded-none sm:border-0 sm:border-s sm:first:border-s-0",
              isToday && "ring-burgundy ring-1 sm:ring-0",
            )}
          >
            <div
              className={cn(
                "flex items-baseline gap-2 border-b px-3 py-2 sm:flex-col sm:items-center sm:gap-0",
                isToday ? "bg-burgundy text-cream" : "bg-muted/50",
              )}
            >
              <span className="text-[0.7rem] font-medium tracking-wide uppercase">
                {formatBusinessDate(day, { weekday: "short" })}
              </span>
              <span className="font-display text-lg leading-tight">
                {formatBusinessDate(day, { day: "numeric", month: "short" })}
              </span>
              {isToday ? <span className="ms-auto text-xs sm:ms-0">Today</span> : null}
            </div>
            <ul className="flex flex-col gap-1.5 p-2">
              {list.length ? (
                list.map((e) => {
                  const hours = parseDailyHours(e.daily_hours)[day];
                  const total = daysBetween(e.start_date, e.end_date) + 1;
                  const nth = daysBetween(e.start_date, day) + 1;
                  return (
                    <li key={e.id}>
                      <Link
                        href={eventHref(e.id)}
                        aria-label={`${e.name}, ${eventStatusLabels[e.status]}`}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs transition-opacity hover:opacity-85",
                          statusChip[e.status],
                          e.type === "private_booking" && "border-s-gold border-s-[3px]",
                        )}
                      >
                        <span className="flex items-center gap-1 font-medium">
                          <TypeIcon type={e.type} className="size-3" />
                          <span className="line-clamp-2">{e.name}</span>
                        </span>
                        <span className="opacity-80">
                          {hours ? `${hours.open}–${hours.close}` : null}
                          {hours && total > 1 ? " · " : null}
                          {total > 1 ? `Day ${nth}/${total}` : null}
                        </span>
                      </Link>
                    </li>
                  );
                })
              ) : (
                <li className="text-muted-foreground px-1 py-1 text-xs sm:text-center">—</li>
              )}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
