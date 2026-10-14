import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { shiftAnchor, startOfWeek, addDays, type CalendarView } from "@/modules/events/calendar";
import {
  eventStatusLabels,
  eventStatuses,
  eventTypeLabels,
  eventTypes,
  type EventStatus,
  type EventType,
} from "@/modules/events/schema";
import { TypeIcon, statusDot } from "./event-style";

export type CalendarParams = {
  /** Undefined = automatic: list on phones, month on larger screens. */
  view?: CalendarView;
  date: string;
  status: EventStatus[];
  type: EventType[];
};

export function calendarHref(p: CalendarParams, patch: Partial<CalendarParams> = {}) {
  const next = { ...p, ...patch };
  const qs = new URLSearchParams();
  if (next.view) qs.set("view", next.view);
  qs.set("date", next.date);
  if (next.status.length) qs.set("status", next.status.join(","));
  if (next.type.length) qs.set("type", next.type.join(","));
  return `/admin/calendar?${qs}`;
}

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

export function CalendarToolbar({
  params,
  today,
  canManage,
}: {
  params: CalendarParams;
  today: string;
  canManage: boolean;
}) {
  const navView = params.view ?? "month";
  const title =
    params.view === "week"
      ? weekTitle(params.date)
      : formatBusinessDate(params.date, { month: "long", year: "numeric" });

  const views: { key: CalendarView; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "week", label: "Week" },
    { key: "list", label: "List" },
  ];
  const isActive = (k: CalendarView) =>
    params.view
      ? params.view === k
        ? "always"
        : "never"
      : k === "month"
        ? "desktop"
        : k === "list"
          ? "phone"
          : "never";

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2
          className="text-burgundy min-w-0 flex-1 truncate text-2xl sm:text-3xl"
          data-testid="calendar-title"
        >
          {title}
        </h2>
        <nav aria-label="Change period" className="flex items-center gap-1">
          <Link
            href={calendarHref(params, { date: shiftAnchor(navView, params.date, -1) })}
            aria-label="Previous"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronLeft className="rtl:rotate-180" />
          </Link>
          <Link
            href={calendarHref(params, { date: today })}
            className={buttonVariants({ variant: "outline" })}
          >
            Today
          </Link>
          <Link
            href={calendarHref(params, { date: shiftAnchor(navView, params.date, 1) })}
            aria-label="Next"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <ChevronRight className="rtl:rotate-180" />
          </Link>
        </nav>
        {canManage ? (
          <Link
            href={`/admin/calendar/new?date=${params.date >= today ? params.date : today}`}
            className={cn(buttonVariants(), "hidden sm:inline-flex")}
          >
            <Plus /> New event
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="bg-muted inline-flex rounded-lg p-0.5">
          {views.map((v) => {
            const a = isActive(v.key);
            return (
              <Link
                key={v.key}
                href={calendarHref(params, { view: v.key })}
                aria-current={a === "always" ? "page" : undefined}
                className={cn(
                  "text-muted-foreground inline-flex h-9 items-center rounded-md px-3.5 text-sm font-medium transition-colors",
                  a === "always" && "bg-card text-burgundy shadow-sm",
                  a === "desktop" && "sm:bg-card sm:text-burgundy sm:shadow-sm",
                  a === "phone" && "max-sm:bg-card max-sm:text-burgundy max-sm:shadow-sm",
                )}
              >
                {v.label}
              </Link>
            );
          })}
        </div>

        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {eventStatuses.map((s) => {
            const on = params.status.includes(s);
            return (
              <Link
                key={s}
                href={calendarHref(params, { status: toggle(params.status, s) })}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  on
                    ? "border-burgundy bg-pink-wash text-burgundy"
                    : "text-muted-foreground bg-card hover:text-foreground",
                )}
              >
                <span className={cn("size-2 rounded-full", statusDot[s])} aria-hidden />
                {eventStatusLabels[s]}
              </Link>
            );
          })}
          <span className="bg-border mx-1 w-px shrink-0" aria-hidden />
          {eventTypes.map((t) => {
            const on = params.type.includes(t);
            return (
              <Link
                key={t}
                href={calendarHref(params, { type: toggle(params.type, t) })}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                  on
                    ? "border-burgundy bg-pink-wash text-burgundy"
                    : "text-muted-foreground bg-card hover:text-foreground",
                )}
              >
                <TypeIcon type={t} />
                {eventTypeLabels[t]}
              </Link>
            );
          })}
          {params.status.length || params.type.length ? (
            <Link
              href={calendarHref(params, { status: [], type: [] })}
              className="text-burgundy inline-flex h-9 shrink-0 items-center px-2 text-xs underline underline-offset-4"
            >
              Clear
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function weekTitle(anchor: string) {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${formatBusinessDate(start, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${formatBusinessDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
}
