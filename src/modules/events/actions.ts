"use server";

import { revalidatePath, updateTag } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Overlap } from "./queries";
import * as events from "./service";

/** Storefront availability is cached under this tag (see DECISIONS T25). */
const STOCK_TAG = "stock";

const entries = (fd: FormData) => Object.fromEntries(fd.entries());

function refresh(stock = false) {
  revalidatePath("/admin/calendar", "layout");
  if (stock) {
    updateTag(STOCK_TAG);
    revalidatePath("/admin/inventory", "layout");
  }
}

export async function saveEventAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ id: string; created: boolean }>> {
  try {
    const created = !fd.get("id");
    const res = await events.saveEvent(entries(fd));
    refresh();
    return ok({ ...res, created }, created ? "Event created." : "Event saved.");
  } catch (e) {
    return fail(e);
  }
}

export async function checkOverlapsAction(input: {
  startDate: string;
  endDate: string;
  excludeId?: string;
  location?: string;
}): Promise<Overlap[]> {
  try {
    return await events.checkOverlaps(input);
  } catch {
    return [];
  }
}

export async function reopenEventAction(eventId: string): Promise<ActionResult> {
  try {
    await events.reopenEvent(eventId);
    refresh();
    return ok(undefined, "Event reopened.");
  } catch (e) {
    return fail(e);
  }
}

export async function assignStaffAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await events.assignStaff(entries(fd));
    refresh();
    return ok(undefined, "Staff assigned.");
  } catch (e) {
    return fail(e);
  }
}

export async function removeStaffAction(assignmentId: string): Promise<ActionResult> {
  try {
    await events.removeStaff(assignmentId);
    refresh();
    return ok(undefined, "Removed from the event.");
  } catch (e) {
    return fail(e);
  }
}

export async function addExpenseAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await events.addExpense(entries(fd));
    refresh();
    return ok(undefined, "Expense added.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  try {
    await events.deleteExpense(expenseId);
    refresh();
    return ok(undefined, "Expense deleted.");
  } catch (e) {
    return fail(e);
  }
}

export async function addDocumentAction(input: {
  eventId: string;
  name: string;
  storagePath: string;
  mime?: string | null;
  sizeBytes?: number | null;
}): Promise<ActionResult> {
  try {
    await events.addDocument(input);
    refresh();
    return ok(undefined, "Document uploaded.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  try {
    await events.deleteDocument(documentId);
    refresh();
    return ok(undefined, "Document deleted.");
  } catch (e) {
    return fail(e);
  }
}

/** Form fields `qty:<variantId>` → allocation lines. */
function prefixed(fd: FormData, prefix: string) {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries())
    if (k.startsWith(prefix) && typeof v === "string") out[k.slice(prefix.length)] = v;
  return out;
}

export async function allocateStockAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ units: number }>> {
  try {
    const lines = Object.entries(prefixed(fd, "qty:"))
      .filter(([, qty]) => qty.trim() !== "")
      .map(([variantId, qty]) => ({ variantId, qty }));
    const units = await events.allocateStock({ eventId: fd.get("eventId"), lines });
    refresh(true);
    return ok({ units }, `${units} unit${units === 1 ? "" : "s"} allocated to the event.`);
  } catch (e) {
    return fail(e);
  }
}

/** Form fields `returning:<variantId>` and `reason:<variantId>`. */
export async function closeEventAction(
  _: unknown,
  fd: FormData,
): Promise<ActionResult<{ returned: number; damaged: number }>> {
  try {
    const reasons = prefixed(fd, "reason:");
    const closeEntries = Object.entries(prefixed(fd, "returning:")).map(
      ([variantId, returning]) => ({
        variantId,
        returning: returning.trim() === "" ? Number.NaN : returning,
        reason: reasons[variantId],
      }),
    );
    const res = await events.closeEvent({
      eventId: fd.get("eventId"),
      toLocationId: fd.get("toLocationId") || undefined,
      entries: closeEntries,
    });
    refresh(true);
    return ok(
      res,
      `Event closed — ${res.returned} returned to stock${res.damaged ? `, ${res.damaged} recorded as broken` : ""}.`,
    );
  } catch (e) {
    return fail(e);
  }
}
