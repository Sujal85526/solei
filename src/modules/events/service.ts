import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { eventStock, findOverlaps } from "./queries";
import {
  allocateSchema,
  assignStaffSchema,
  closeOutSchema,
  documentSchema,
  eventSchema,
  expenseSchema,
  isEventObjectPath,
  overlapQuerySchema,
  planCloseOut,
} from "./schema";

const BUCKET = "event-docs";

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "P0001" || error.code === "P0002") {
    const msg = error.message.replace(/^.*?: /, "");
    throw new UserError(msg.charAt(0).toUpperCase() + msg.slice(1) + ".");
  }
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "23505") throw new UserError("That's already been added.");
  throw new Error(error.message);
}

// ─── Events ───────────────────────────────────────────────────────────────────────────────

export async function saveEvent(input: unknown): Promise<{ id: string }> {
  await assertPermission("events.manage");
  const v = eventSchema.parse(input);
  const supabase = await createClient();
  const row = {
    name: v.name,
    type: v.type,
    status: v.status,
    organiser_name: v.organiserName,
    organiser_contact: v.organiserContact,
    organiser_phone: v.organiserPhone,
    organiser_email: v.organiserEmail,
    location: v.location,
    emirate: v.emirate,
    start_date: v.startDate,
    end_date: v.endDate,
    daily_hours: v.dailyHours,
    booth_details: v.boothDetails,
    participation_fee_fils: v.participationFeeFils,
    fee_payment_status: v.feePaymentStatus,
    notes: v.notes,
  };
  if (v.id) {
    const { error } = await supabase.from("events").update(row).eq("id", v.id);
    if (error) dbError(error);
    return { id: v.id };
  }
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...row, created_by: auth.user?.id })
    .select("id")
    .single();
  if (error) dbError(error);
  return { id: data.id };
}

/** Other events on the same dates — shown as a warning, never a block (DECISIONS D9). */
export async function checkOverlaps(input: unknown) {
  await assertPermission("events.view");
  const parsed = overlapQuerySchema.safeParse(input);
  if (!parsed.success) return [];
  return findOverlaps(parsed.data);
}

export async function reopenEvent(eventId: string) {
  await assertPermission("events.manage");
  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_event", { p_event_id: eventId });
  if (error) dbError(error);
}

// ─── Staff ────────────────────────────────────────────────────────────────────────────────

export async function assignStaff(input: unknown) {
  await assertPermission("events.manage");
  const v = assignStaffSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_staff")
    .insert({ event_id: v.eventId, user_id: v.userId, role: v.role });
  if (error) dbError(error);
}

export async function removeStaff(assignmentId: string) {
  await assertPermission("events.manage");
  const supabase = await createClient();
  const { error } = await supabase.from("event_staff").delete().eq("id", assignmentId);
  if (error) dbError(error);
}

// ─── Expenses (financial) ─────────────────────────────────────────────────────────────────

export async function addExpense(input: unknown) {
  await assertPermission("events.manage");
  await assertPermission("reports.financial.view");
  const v = expenseSchema.parse(input);
  if (v.receiptPath && !isEventObjectPath(v.eventId, "receipts", v.receiptPath))
    throw new UserError("That receipt doesn't belong to this event.");
  const supabase = await createClient();
  const { error } = await supabase.from("event_expenses").insert({
    event_id: v.eventId,
    category: v.category,
    amount_fils: v.amountAed,
    incurred_on: v.incurredOn,
    note: v.note,
    receipt_path: v.receiptPath,
  });
  if (error) dbError(error);
}

export async function deleteExpense(expenseId: string) {
  await assertPermission("events.manage");
  await assertPermission("reports.financial.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_expenses")
    .delete()
    .eq("id", expenseId)
    .select("receipt_path")
    .maybeSingle();
  if (error) dbError(error);
  if (data?.receipt_path) await supabase.storage.from(BUCKET).remove([data.receipt_path]);
}

// ─── Documents ────────────────────────────────────────────────────────────────────────────

export async function addDocument(input: unknown) {
  await assertPermission("events.manage");
  const v = documentSchema.parse(input);
  if (!isEventObjectPath(v.eventId, "docs", v.storagePath))
    throw new UserError("That upload doesn't belong to this event.");
  const supabase = await createClient();
  const { error } = await supabase.from("event_documents").insert({
    event_id: v.eventId,
    name: v.name,
    storage_path: v.storagePath,
    mime: v.mime ?? null,
    size_bytes: v.sizeBytes ?? null,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([v.storagePath]);
    dbError(error);
  }
}

export async function deleteDocument(documentId: string) {
  await assertPermission("events.manage");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_documents")
    .delete()
    .eq("id", documentId)
    .select("storage_path")
    .maybeSingle();
  if (error) dbError(error);
  if (data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path]);
}

// ─── Stock ────────────────────────────────────────────────────────────────────────────────

export async function allocateStock(input: unknown): Promise<number> {
  await assertPermission("events.manage");
  await assertPermission("inventory.transfer");
  const v = allocateSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("allocate_event_stock", {
    p_event_id: v.eventId,
    p_lines: v.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
  });
  if (error) dbError(error);
  return data ?? 0;
}

export async function closeEvent(input: unknown): Promise<{ returned: number; damaged: number }> {
  await assertPermission("events.manage");
  await assertPermission("inventory.transfer");
  const v = closeOutSchema.parse(input);
  // Plan against the live ledger, not what the form saw (a POS sale may have happened since).
  const { rows } = await eventStock(v.eventId);
  const plan = planCloseOut(rows, v.entries);
  const firstError = Object.entries(plan.errors)[0];
  if (firstError) {
    const label = rows.find((r) => r.variantId === firstError[0])?.label ?? "A product";
    throw new UserError(`${label}: ${firstError[1]}.`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_event_stock", {
    p_event_id: v.eventId,
    p_returns: plan.returns,
    p_damages: plan.damages,
    p_to_location: v.toLocationId,
  });
  if (error) dbError(error);
  return { returned: plan.returned, damaged: plan.damaged };
}
