import type { Metadata } from "next";
import { AttendanceNav } from "@/components/admin/attendance/attendance-nav";
import { DeleteShiftButton, ShiftDialog } from "@/components/admin/attendance/shift-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay, formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { eventsBetween, listShifts, staffPeople } from "@/modules/attendance/queries";
import { hoursText, shiftMinutes, totalsByUser } from "@/modules/attendance/schema";

export const metadata: Metadata = { title: "Attendance" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const time = (iso: string) => formatBusinessDate(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * Clock-in hours. Everyone sees their own; with staff.manage, everyone's — with totals per person
 * and the means to add or correct a shift.
 */
export default async function AttendancePage({ searchParams }: PageProps<"/admin/attendance">) {
  const staff = await requirePagePermission("dashboard.view");
  const sp = await searchParams;
  const today = businessDay();
  const pick = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
  const from = pick(sp.from) ?? `${today.slice(0, 8)}01`;
  const to = pick(sp.to) ?? today;
  const who = typeof sp.who === "string" && /^[0-9a-f-]{36}$/.test(sp.who) ? sp.who : undefined;
  const { shifts, all } = await listShifts(from, to, who);
  const [people, events] = all
    ? await Promise.all([staffPeople(), eventsBetween(from, to)])
    : [[], []];
  const names = new Map(people.map((p) => [p.id, p.name]));
  const totals = totalsByUser(shifts);
  const totalMinutes = [...totals.values()].reduce((s, m) => s + m, 0);

  return (
    <>
      <PageHeader
        title="Attendance"
        description={
          all
            ? "Everyone's clock-in hours. Times in Abu Dhabi."
            : "Your clock-in hours. Clock in and out on the dashboard."
        }
        actions={all ? <ShiftDialog people={people} events={events} /> : null}
      />
      <AttendanceNav canReport={can(staff.permissions, "reports.view")} />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3" aria-label="Period">
        <label className="flex flex-col gap-1.5 text-sm">
          From
          <Input type="date" name="from" defaultValue={from} className="h-10 w-40" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          To
          <Input type="date" name="to" defaultValue={to} className="h-10 w-40" />
        </label>
        {all ? (
          <label className="flex flex-col gap-1.5 text-sm">
            Who
            <NativeSelect name="who" defaultValue={who ?? ""} className="[&_button]:h-10">
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <Button type="submit" variant="outline" className="h-10">
          Show
        </Button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hours" value={hoursText(totalMinutes)} />
        <StatCard label="Shifts" value={shifts.length} />
        {all
          ? [...totals.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([id, m]) => (
                <StatCard key={id} label={names.get(id) ?? "Staff"} value={hoursText(m)} />
              ))
          : null}
      </div>

      <AdminSection title="Shifts">
        {shifts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No shifts in these days.</p>
        ) : (
          <ul className="-mx-5 divide-y text-sm sm:-mx-6">
            {shifts.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {all ? `${names.get(s.userId) ?? "Staff"} · ` : ""}
                    {formatBusinessDate(s.clockIn, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {time(s.clockIn)} – {s.clockOut ? time(s.clockOut) : "now"}
                    {s.eventName ? ` · ${s.eventName}` : ""}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                </span>
                {s.clockOut ? null : <Badge variant="success">On shift</Badge>}
                <span className="numeric shrink-0">{hoursText(shiftMinutes(s))}</span>
                {all ? (
                  <span className="flex shrink-0">
                    <ShiftDialog shift={s} people={people} events={events} />
                    <DeleteShiftButton id={s.id} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </>
  );
}
