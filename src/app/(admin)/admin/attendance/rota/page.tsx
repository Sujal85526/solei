import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceNav } from "@/components/admin/attendance/attendance-nav";
import {
  CopyWeekButton,
  DeleteRotaShiftButton,
  RotaShiftDialog,
} from "@/components/admin/attendance/rota";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { eventsBetween, staffPeople } from "@/modules/attendance/queries";
import { hoursText } from "@/modules/attendance/schema";
import { listRota } from "@/modules/rota/queries";
import {
  localTime,
  parseWeek,
  plannedMinutes,
  shiftDay,
  shiftWeek,
  weekDays,
} from "@/modules/rota/schema";

export const metadata: Metadata = { title: "Rota" };

/**
 * Planned shifts, a week at a time. Everyone sees their own; with staff.manage, everyone's — and
 * plans, changes or copies them. Hours actually worked are on the Hours tab (clock in / out).
 */
export default async function RotaPage({ searchParams }: PageProps<"/admin/attendance/rota">) {
  const staff = await requirePagePermission("dashboard.view");
  const monday = parseWeek((await searchParams).week);
  const days = weekDays(monday);
  const { shifts, all } = await listRota(days[0], days[6]);
  const [people, events] = all
    ? await Promise.all([staffPeople(), eventsBetween(days[0], days[6])])
    : [[], []];
  const names = new Map(people.map((p) => [p.id, p.name]));
  const today = businessDay();
  const total = shifts.reduce((s, x) => s + plannedMinutes(x), 0);
  const weekLabel = `${formatBusinessDate(days[0], { day: "numeric", month: "short" })} – ${formatBusinessDate(days[6])}`;

  return (
    <>
      <PageHeader
        title="Rota"
        description={
          all
            ? "Plan who works when. Staff see their own shifts here and get a reminder email if it's on."
            : "Your planned shifts. Times in Abu Dhabi."
        }
        actions={
          all ? (
            <>
              <CopyWeekButton from={shiftWeek(monday, -1)} to={monday} />
              <RotaShiftDialog people={people} events={events} />
            </>
          ) : null
        }
      />
      <AttendanceNav canReport={can(staff.permissions, "reports.view")} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link
          href={`?week=${shiftWeek(monday, -1)}`}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          aria-label="Previous week"
        >
          <ChevronLeft className="rtl:rotate-180" />
        </Link>
        <Link
          href={`?week=${shiftWeek(monday, 1)}`}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          aria-label="Next week"
        >
          <ChevronRight className="rtl:rotate-180" />
        </Link>
        <span className="font-medium">{weekLabel}</span>
        {days.includes(today) ? null : (
          <Link
            href="/admin/attendance/rota"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            This week
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Shifts" value={shifts.length} />
        <StatCard label="Planned hours" value={hoursText(total)} />
      </div>

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const dayShifts = shifts.filter((s) => shiftDay(s.startsAt) === d);
          return (
            <li
              key={d}
              className={cn(
                "bg-card flex flex-col rounded-xl border",
                d === today && "border-burgundy",
              )}
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-medium">
                  {formatBusinessDate(d, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                {all ? <RotaShiftDialog day={d} people={people} events={events} /> : null}
              </div>
              {dayShifts.length === 0 ? (
                <p className="text-muted-foreground px-3 py-3 text-xs">—</p>
              ) : (
                <ul className="divide-y text-sm">
                  {dayShifts.map((s) => (
                    <li key={s.id} className="flex items-start gap-1 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        {all ? (
                          <span className="block truncate font-medium">
                            {names.get(s.userId) ?? "Staff"}
                          </span>
                        ) : null}
                        <span className="numeric block">
                          {localTime(s.startsAt)}–{localTime(s.endsAt)}
                        </span>
                        {s.eventName || s.note ? (
                          <span className="text-muted-foreground block text-xs">
                            {[s.eventName, s.note].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      {all ? (
                        <span className="flex shrink-0 flex-col">
                          <RotaShiftDialog shift={s} people={people} events={events} />
                          <DeleteRotaShiftButton id={s.id} />
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
