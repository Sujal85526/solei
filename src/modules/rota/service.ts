import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { rotaShiftSchema } from "./schema";

export async function saveRotaShift(input: unknown) {
  const staff = await assertPermission("staff.manage");
  const v = rotaShiftSchema.parse(input);
  if (new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() > 24 * 3_600_000) {
    throw new UserError("A shift can be up to 24 hours.");
  }
  const supabase = await createClient();
  const row = {
    user_id: v.userId,
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    event_id: v.eventId ?? null,
    note: v.note,
  };
  const { error } = v.id
    ? await supabase.from("staff_shifts").update(row).eq("id", v.id)
    : await supabase.from("staff_shifts").insert({ ...row, created_by: staff.userId });
  if (error) throw new Error(error.message);
}

export async function deleteRotaShift(id: string) {
  await assertPermission("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("staff_shifts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Copy last week's shifts into this week (same days and times), for a regular rota. */
export async function copyRotaWeek(fromMonday: string, toMonday: string): Promise<number> {
  const staff = await assertPermission("staff.manage");
  const supabase = await createClient();
  const start = new Date(`${fromMonday}T00:00:00+04:00`);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const shiftMs = new Date(`${toMonday}T00:00:00+04:00`).getTime() - start.getTime();
  const { data, error } = await supabase
    .from("staff_shifts")
    .select("user_id, starts_at, ends_at, event_id, note")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString());
  if (error) throw new Error(error.message);
  if (!data.length) throw new UserError("Nothing planned that week to copy.");
  const move = (iso: string) => new Date(new Date(iso).getTime() + shiftMs).toISOString();
  const { error: insertError } = await supabase.from("staff_shifts").insert(
    data.map((s) => ({
      user_id: s.user_id,
      starts_at: move(s.starts_at),
      ends_at: move(s.ends_at),
      // An event belongs to its own dates; the copy is a plain shift.
      event_id: null,
      note: s.note,
      created_by: staff.userId,
    })),
  );
  if (insertError) throw new Error(insertError.message);
  return data.length;
}
