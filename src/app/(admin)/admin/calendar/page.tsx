import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CalendarToolbar, type CalendarParams } from "@/components/admin/events/calendar-toolbar";
import { CalendarLegend } from "@/components/admin/events/event-style";
import { ListView } from "@/components/admin/events/list-view";
import { MonthView } from "@/components/admin/events/month-view";
import { WeekView } from "@/components/admin/events/week-view";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { can } from "@/lib/permissions";
import {
  isDay,
  monthWeeks,
  parseView,
  rangesOverlap,
  viewRange,
  weekDays,
} from "@/modules/events/calendar";
import { listEvents } from "@/modules/events/queries";
import {
  eventStatuses,
  eventTypes,
  type EventStatus,
  type EventType,
} from "@/modules/events/schema";

export const metadata: Metadata = { title: "Calendar" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const list = <T extends string>(v: string | undefined, allowed: readonly T[]) =>
  (v ?? "").split(",").filter((x): x is T => allowed.includes(x as T));

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const staff = await requirePagePermission("events.view");
  const sp = await searchParams;
  const today = businessDay();
  const date = str(sp.date);
  const params: CalendarParams = {
    view: parseView(str(sp.view)),
    date: isDay(date) ? date : today,
    status: list<EventStatus>(str(sp.status), eventStatuses),
    type: list<EventType>(str(sp.type), eventTypes),
  };
  const canManage = can(staff.permissions, "events.manage");

  // Automatic view renders month (tablet/desktop) and list (phone) from one month of data.
  const range = viewRange(params.view ?? "month", params.date);
  const events = await listEvents(range, { status: params.status, type: params.type });
  const month = params.date.slice(0, 7);
  const monthRange = viewRange("list", params.date);
  const inMonth = events.filter((e) =>
    rangesOverlap({ start: e.start_date, end: e.end_date }, monthRange),
  );

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Exhibitions, pop-ups and private bookings. Tap an event for staff, stock and close-out."
      />
      <CalendarToolbar params={params} today={today} canManage={canManage} />

      {params.view === "week" ? (
        <WeekView days={weekDays(params.date)} events={events} today={today} />
      ) : params.view === "list" ? (
        <ListView events={events} today={today} />
      ) : params.view === "month" ? (
        <MonthView weeks={monthWeeks(params.date)} month={month} events={events} today={today} />
      ) : (
        <>
          <div className="hidden sm:block">
            <MonthView
              weeks={monthWeeks(params.date)}
              month={month}
              events={events}
              today={today}
            />
          </div>
          <div className="sm:hidden">
            <ListView events={inMonth} today={today} />
          </div>
        </>
      )}

      <div className="mt-6">
        <CalendarLegend />
      </div>

      {canManage ? (
        <Link
          href={`/admin/calendar/new?date=${params.date >= today ? params.date : today}`}
          aria-label="New event"
          className="bg-burgundy text-cream fixed end-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex size-14 items-center justify-center rounded-full shadow-lg sm:hidden"
        >
          <Plus className="size-6" />
        </Link>
      ) : null}
    </>
  );
}
