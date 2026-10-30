import "server-only";
import { assertPermission, requireStaff } from "@/lib/auth/session";
import { businessDay, businessDayRange } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Shift } from "./schema";
import { hiddenStaffIds } from "@/modules/staff/hidden";

type Row = {
  id: string;
  user_id: string;
  event_id: string | null;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  events: { name: string } | null;
};
const toShift = (r: Row): Shift => ({
  id: r.id,
  userId: r.user_id,
  eventId: r.event_id,
  eventName: r.events?.name ?? null,
  clockIn: r.clock_in,
  clockOut: r.clock_out,
  note: r.note,
});

/** The signed-in staff member's open shift, if any. */
export async function myOpenShift(): Promise<Shift | null> {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_attendance")
    .select("id, user_id, event_id, clock_in, clock_out, note, events(name)")
    .eq("user_id", staff.userId)
    .is("clock_out", null)
    .maybeSingle();
  return data ? toShift(data as unknown as Row) : null;
}

/**
 * Shifts started between two business days (inclusive): the caller's own, or — with staff.manage
 * — everyone's (optionally one person).
 */
export async function listShifts(
  from: string,
  to: string,
  userId?: string,
): Promise<{ shifts: Shift[]; all: boolean }> {
  const staff = await requireStaff();
  const all = can(staff.permissions, "staff.manage");
  const supabase = await createClient();
  let q = supabase
    .from("staff_attendance")
    .select("id, user_id, event_id, clock_in, clock_out, note, events(name)")
    .gte("clock_in", businessDayRange(from).start.toISOString())
    .lte("clock_in", businessDayRange(to).end.toISOString())
    .order("clock_in", { ascending: false })
    .limit(500);
  if (!all) q = q.eq("user_id", staff.userId);
  else if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { shifts: (data as unknown as Row[]).map(toShift), all };
}

/** Events on today (or the given day) to clock in at. */
export async function eventsOn(day = businessDay()): Promise<{ id: string; name: string }[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name")
    .lte("start_date", day)
    .gte("end_date", day)
    .neq("status", "cancelled")
    .order("name");
  return data ?? [];
}

/** Active staff for the owner's filters and the correction form. */
export async function staffPeople(): Promise<{ id: string; name: string }[]> {
  await assertPermission("staff.manage");
  const supabase = await createClient();
  const [{ data }, hidden] = await Promise.all([
    supabase.from("staff_profiles").select("user_id, full_name").order("full_name"),
    hiddenStaffIds(),
  ]);
  return (data ?? [])
    .filter((s) => !hidden.has(s.user_id))
    .map((s) => ({ id: s.user_id, name: s.full_name }));
}

/** Events overlapping a period (for the owner's shift form). */
export async function eventsBetween(
  from: string,
  to: string,
): Promise<{ id: string; name: string }[]> {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name")
    .lte("start_date", to)
    .gte("end_date", from)
    .neq("status", "cancelled")
    .order("start_date", { ascending: false });
  return data ?? [];
}
