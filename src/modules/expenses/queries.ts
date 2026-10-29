import "server-only";
import { assertPermission } from "@/lib/auth/session";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";

/** Expense categories (hidden ones too), in order. Needs reports.financial.view. */
export async function expenseCategories() {
  await assertPermission("reports.financial.view");
  const supabase = await createClient();
  return must(
    await supabase
      .from("business_expense_categories")
      .select("id, name, active, sort")
      .order("sort")
      .order("name"),
    "expense categories",
  );
}

export type ExpenseCategoryRow = Awaited<ReturnType<typeof expenseCategories>>[number];

/** Business expenses between two days (inclusive), newest first. Needs reports.financial.view. */
export async function businessExpenses(from: string, to: string) {
  await assertPermission("reports.financial.view");
  const supabase = await createClient();
  return must(
    await supabase
      .from("business_expenses")
      .select("id, category_id, amount_fils, spent_on, note")
      .gte("spent_on", from)
      .lte("spent_on", to)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false }),
    "business expenses",
  );
}

export type BusinessExpenseRow = Awaited<ReturnType<typeof businessExpenses>>[number];
