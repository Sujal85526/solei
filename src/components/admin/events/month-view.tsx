"use client";

import { useState } from "react";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { WEEKDAY_LABELS, eventsOnDay, layoutWeek } from "@/modules/events/calendar";
import type { CalendarEvent } from "@/modules/events/queries";
import { EventCard } from "./event-card";
import { EventChip } from "./event-chip";
import { statusDot } from "./event-style";

/** Bars shown per week row before collapsing into "+N more". */
const MAX_LANES = 3;

/**
 * Month grid. Tablet/desktop: multi-day bars laid out in lanes. Phone: compact cells with
 * status dots; tapping a day lists its events underneath.
 */
export function MonthView({
  weeks,
  month,
  events,
  today,
}: {
  weeks: string[][];
  /** `YYYY-MM` of the month being shown. */
  month: string;
  events: CalendarEvent[];
  today: string;
}) {
  const inMonth = (d: string) => d.startsWith(month);
  const initial = today.startsWith(month)
    ? today
    : (weeks.flat().find((d) => inMonth(d) && eventsOnDay(events, d).length) ?? `${month}-01`);
  const [selected, setSelected] = useState(initial);
  const selectedEvents = eventsOnDay(events, selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-card overflow-hidden rounded-xl border" role="grid" aria-label="Month">
        <div className="bg-muted/60 grid grid-cols-7 border-b" role="row">
          {WEEKDAY_LABELS.map((d) => (
            <div
              key={d}
              role="columnheader"
              className="text-muted-foreground py-2 text-center text-[0.7rem] font-medium tracking-wide uppercase"
            >
              <span className="sm:hidden">{d.slice(0, 1)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        {weeks.map((week) => {
          const segments = layoutWeek(events, week);
          return (
            <div
              key={week[0]}
              role="row"
              className="grid grid-cols-7 border-b last:border-b-0 sm:[grid-template-rows:auto_repeat(4,1.625rem)] sm:pb-1.5"
            >
              {week.map((day, i) => {
                const dayEvents = eventsOnDay(events, day);
                const hidden = segments.filter(
                  (s) => s.lane >= MAX_LANES && s.col <= i && i < s.col + s.span,
                ).length;
                const isToday = day === today;
                const isSelected = day === selected;
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${formatBusinessDate(day, { weekday: "long", day: "numeric", month: "long" })}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}${isToday ? ", today" : ""}`}
                    data-day={day}
                    onClick={() => setSelected(day)}
                    style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                    className={cn(
                      "relative flex min-h-14 flex-col items-center gap-1 border-s pt-1.5 pb-2 first:border-s-0 sm:min-h-28 sm:items-end sm:px-2 sm:pt-1.5",
                      !inMonth(day) && "bg-muted/35",
                      isSelected && "max-sm:bg-pink-wash",
                      "sm:cursor-default",
                    )}
                  >
                    <span
                      className={cn(
                        "numeric flex size-7 items-center justify-center rounded-full text-sm",
                        inMonth(day) ? "text-foreground" : "text-muted-foreground/60",
                        isToday && "bg-burgundy text-cream font-semibold",
                        isSelected && !isToday && "max-sm:ring-burgundy max-sm:ring-1",
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {/* Phone: dots */}
                    <span className="flex h-2 items-center gap-0.5 sm:hidden" aria-hidden>
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn("size-1.5 rounded-full", statusDot[e.status])}
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <span className="text-muted-foreground text-[0.55rem] leading-none">+</span>
                      ) : null}
                    </span>
                    {hidden ? (
                      <span className="text-muted-foreground absolute end-2 bottom-1 hidden text-[0.65rem] sm:block">
                        +{hidden} more
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {/* Tablet/desktop: bars */}
              {segments
                .filter((s) => s.lane < MAX_LANES)
                .map((s) => (
                  <EventChip
                    key={s.event.id}
                    event={s.event}
                    continuesBefore={s.continuesBefore}
                    continuesAfter={s.continuesAfter}
                    className={cn(
                      "relative z-10 mx-1 hidden self-center sm:flex",
                      s.continuesBefore && "ms-0",
                      s.continuesAfter && "me-0",
                    )}
                    style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 2 }}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {/* Selected day (phones; on larger screens the bars already show everything) */}
      <section aria-live="polite" className="sm:hidden" data-testid="selected-day">
        <h2 className="text-foreground mb-2 font-sans text-sm font-semibold">
          {formatBusinessDate(selected, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {selectedEvents.length ? (
          <ul className="flex flex-col gap-2">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <EventCard event={e} today={today} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-4 text-sm">
            Nothing on this day.
          </p>
        )}
      </section>
    </div>
  );
}
