"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import * as expenses from "./service";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());
const refresh = () => revalidatePath("/admin/reports", "layout");

export async function saveExpenseAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await expenses.saveExpense(entries(fd));
    refresh();
    return ok(undefined, fd.get("id") ? "Expense updated." : "Expense added.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  try {
    await expenses.deleteExpense(id);
    refresh();
    return ok(undefined, "Expense deleted.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveCategoryAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await expenses.saveCategory(entries(fd));
    refresh();
    return ok(undefined, fd.get("id") ? "Category renamed." : "Category added.");
  } catch (e) {
    return fail(e);
  }
}

export async function setCategoryActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    await expenses.setCategoryActive(id, active);
    refresh();
    return ok(undefined, active ? "Category shown." : "Category hidden.");
  } catch (e) {
    return fail(e);
  }
}
