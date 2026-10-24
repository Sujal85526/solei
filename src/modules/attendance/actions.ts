"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { clockIn, clockOut, deleteShift, saveShift } from "./service";

const refresh = () => {
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
};

export async function clockInAction(eventId?: string | null): Promise<ActionResult> {
  try {
    await clockIn(eventId);
    refresh();
    return ok(undefined, "Clocked in.");
  } catch (e) {
    return fail(e);
  }
}

export async function clockOutAction(note?: string): Promise<ActionResult> {
  try {
    await clockOut(note);
    refresh();
    return ok(undefined, "Clocked out.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveShiftAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveShift(Object.fromEntries(fd.entries()));
    refresh();
    return ok(undefined, "Shift saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteShiftAction(id: string): Promise<ActionResult> {
  try {
    await deleteShift(id);
    refresh();
    return ok(undefined, "Shift removed.");
  } catch (e) {
    return fail(e);
  }
}
