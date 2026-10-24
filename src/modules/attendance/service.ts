import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission, requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { shiftFormSchema } from "./schema";

const rethrow = (error: { code?: string; message: string }): never => {
  if (["P0001", "22023", "42501"].includes(error.code ?? "")) {
    throw new UserError(error.message.charAt(0).toUpperCase() + error.message.slice(1));
  }
  throw new Error(error.message);
};

export async function clockIn(eventId?: string | null) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_clock_in", { p_event: eventId || undefined });
  if (error) rethrow(error);
}

export async function clockOut(note?: string) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_clock_out", { p_note: note || undefined });
  if (error) rethrow(error);
}

export async function saveShift(input: unknown) {
  await assertPermission("staff.manage");
  const v = shiftFormSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_save", {
    p: {
      id: v.id ?? null,
      user_id: v.userId,
      event_id: v.eventId ?? null,
      clock_in: v.clockIn,
      clock_out: v.clockOut ?? null,
      note: v.note,
    },
  });
  if (error) rethrow(error);
}

export async function deleteShift(id: string) {
  await assertPermission("staff.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("attendance_delete", { p_id: id });
  if (error) rethrow(error);
}
