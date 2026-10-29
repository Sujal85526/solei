"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { copyRotaWeek, deleteRotaShift, saveRotaShift } from "./service";

const refresh = () => revalidatePath("/admin/attendance/rota");

export async function saveRotaShiftAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await saveRotaShift(Object.fromEntries(fd.entries()));
    refresh();
    return ok(undefined, "Shift saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRotaShiftAction(id: string): Promise<ActionResult> {
  try {
    await deleteRotaShift(id);
    refresh();
    return ok(undefined, "Shift removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function copyRotaWeekAction(from: string, to: string): Promise<ActionResult> {
  try {
    const n = await copyRotaWeek(from, to);
    refresh();
    return ok(undefined, `${n} shift${n === 1 ? "" : "s"} copied.`);
  } catch (e) {
    return fail(e);
  }
}
