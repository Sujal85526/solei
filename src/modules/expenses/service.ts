import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { businessExpenseSchema, expenseCategorySchema } from "./schema";

/**
 * Business (non-event) expenses: reports.financial.view + expenses.manage, checked here and
 * again by RLS. Every write is recorded in audit_log by the table trigger.
 */
async function assertManage() {
  await assertPermission("reports.financial.view");
  await assertPermission("expenses.manage");
}

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  if (error.code === "23505") throw new UserError("There's already a category with that name.");
  if (error.code === "23503") throw new UserError("That category has expenses: hide it instead.");
  throw new Error(error.message);
}

export async function saveExpense(input: unknown) {
  await assertManage();
  const v = businessExpenseSchema.parse(input);
  const row = {
    category_id: v.categoryId,
    amount_fils: v.amountAed,
    spent_on: v.spentOn,
    note: v.note,
  };
  const supabase = await createClient();
  const { error } = v.id
    ? await supabase.from("business_expenses").update(row).eq("id", v.id)
    : await supabase.from("business_expenses").insert(row);
  if (error) dbError(error);
}

export async function deleteExpense(id: string) {
  await assertManage();
  const supabase = await createClient();
  const { error } = await supabase.from("business_expenses").delete().eq("id", id);
  if (error) dbError(error);
}

export async function saveCategory(input: unknown) {
  await assertManage();
  const v = expenseCategorySchema.parse(input);
  const supabase = await createClient();
  if (v.id) {
    const { error } = await supabase
      .from("business_expense_categories")
      .update({ name: v.name })
      .eq("id", v.id);
    if (error) dbError(error);
    return;
  }
  const { data: last } = await supabase
    .from("business_expense_categories")
    .select("sort")
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("business_expense_categories")
    .insert({ name: v.name, sort: (last?.sort ?? 0) + 10 });
  if (error) dbError(error);
}

/** Hidden categories stay on old expenses but can't be picked for new ones. */
export async function setCategoryActive(id: string, active: boolean) {
  await assertManage();
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_expense_categories")
    .update({ active })
    .eq("id", id);
  if (error) dbError(error);
}
