import "server-only";
import { requireStaff } from "@/lib/auth/session";
import { businessDayRange } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { PlannedShift } from "./schema";

type Row = {
  id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  event_id: string | null;
  note: string | null;
  events: { name: string } | null;
};

/**
 * Planned shifts starting between two business days: the caller's own, or everyone's with
 * staff.manage (the table's RLS says the same).
 */
export async function listRota(
  from: string,
  to: string,
): Promise<{ shifts: PlannedShift[]; all: boolean; me: string }> {
  const staff = await requireStaff();
  const all = can(staff.permissions, "staff.manage");
  const supabase = await createClient();
  let q = supabase
    .from("staff_shifts")
    .select("id, user_id, starts_at, ends_at, event_id, note, events(name)")
    .gte("starts_at", businessDayRange(from).start.toISOString())
    .lte("starts_at", businessDayRange(to).end.toISOString())
    .order("starts_at")
    .limit(1000);
  if (!all) q = q.eq("user_id", staff.userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    shifts: (data as unknown as Row[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      eventId: r.event_id,
      eventName: r.events?.name ?? null,
      note: r.note,
    })),
    all,
    me: staff.userId,
  };
}
