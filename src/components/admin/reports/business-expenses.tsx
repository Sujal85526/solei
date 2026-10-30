"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import {
  deleteExpenseAction,
  saveCategoryAction,
  saveExpenseAction,
  setCategoryActiveAction,
} from "@/modules/expenses/actions";
import type { BusinessExpenseRow, ExpenseCategoryRow } from "@/modules/expenses/queries";

const aed = (fils: number) => (fils / 100).toFixed(2).replace(/\.00$/, "");

/** Admin → Reports → Expenses: the month's business expenses, add / edit / delete. */
export function BusinessExpenses({
  expenses,
  categories,
  defaultDate,
  canManage,
}: {
  expenses: BusinessExpenseRow[];
  categories: ExpenseCategoryRow[];
  defaultDate: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<BusinessExpenseRow | null>(null);
  const name = new Map(categories.map((c) => [c.id, c.name]));
  const total = expenses.reduce((s, x) => s + x.amount_fils, 0);
  const byCategory = categories
    .map((c) => ({
      c,
      fils: expenses.filter((x) => x.category_id === c.id).reduce((s, x) => s + x.amount_fils, 0),
    }))
    .filter((x) => x.fils > 0)
    .sort((a, b) => b.fils - a.fils);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-muted-foreground text-xs">Total this month</p>
        <p className="numeric text-xl font-semibold" data-testid="business-expenses-total">
          {formatAED(total)}
        </p>
        {byCategory.length ? (
          <ul className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {byCategory.map((x) => (
              <li key={x.c.id}>
                {x.c.name}: <span className="numeric text-foreground">{formatAED(x.fils)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {expenses.length ? (
        <ul className="divide-y rounded-lg border" data-testid="business-expense-list">
          {expenses.map((x) => (
            <li key={x.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {name.get(x.category_id) ?? "—"}
                  {x.note ? (
                    <span className="text-muted-foreground font-normal"> · {x.note}</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatBusinessDate(x.spent_on, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <span className="numeric text-sm font-semibold">{formatAED(x.amount_fils)}</span>
              {canManage ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit expense"
                    onClick={() => setEditing(x)}
                  >
                    <Pencil />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete expense"
                    title="Delete this expense?"
                    confirmLabel="Delete"
                    destructive
                    action={deleteExpenseAction.bind(null, x.id)}
                  >
                    <Trash2 />
                  </ConfirmButton>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No expenses entered for this month.</p>
      )}

      {canManage ? (
        <ExpenseForm
          key={editing?.id ?? "new"}
          editing={editing}
          categories={categories}
          defaultDate={defaultDate}
          onDone={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ExpenseForm({
  editing,
  categories,
  defaultDate,
  onDone,
}: {
  editing: BusinessExpenseRow | null;
  categories: ExpenseCategoryRow[];
  defaultDate: string;
  onDone: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useFormAction(saveExpenseAction, null);
  const e = useActionToast(state, () => {
    form.current?.reset();
    onDone();
  });
  const choices = categories.filter((c) => c.active || c.id === editing?.category_id);

  return (
    <form
      ref={form}
      {...action}
      noValidate
      className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2 sm:p-4"
    >
      <p className="text-foreground text-sm font-semibold sm:col-span-2">
        {editing ? "Edit expense" : "Add an expense"}
      </p>
      <input type="hidden" name="id" value={editing?.id ?? ""} />
      <Field label="Category" htmlFor="categoryId" error={e.categoryId} required>
        <NativeSelect
          id="categoryId"
          name="categoryId"
          defaultValue={editing?.category_id ?? ""}
          className="[&_button]:h-11"
        >
          <option value="" disabled>
            Choose…
          </option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Amount (AED)" htmlFor="amountAed" error={e.amountAed} required>
        <Input
          id="amountAed"
          name="amountAed"
          inputMode="decimal"
          placeholder="0"
          defaultValue={editing ? aed(editing.amount_fils) : ""}
          className="numeric h-11"
        />
      </Field>
      <Field label="Date" htmlFor="spentOn" error={e.spentOn} required>
        <Input
          id="spentOn"
          name="spentOn"
          type="date"
          defaultValue={editing?.spent_on ?? defaultDate}
          className="h-11"
        />
      </Field>
      <Field label="Note" htmlFor="note" error={e.note}>
        <Input
          id="note"
          name="note"
          placeholder="e.g. October shop rent"
          defaultValue={editing?.note ?? ""}
          className="h-11"
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
        {editing ? (
          <Button type="button" variant="outline" className="h-11" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

/** The owner-editable category list: rename, add, hide / show. */
export function ExpenseCategories({
  categories,
  canManage,
}: {
  categories: ExpenseCategoryRow[];
  canManage: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y rounded-lg border">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            {renaming === c.id ? (
              <CategoryForm category={c} onDone={() => setRenaming(null)} />
            ) : (
              <>
                <span
                  className={
                    c.active
                      ? "flex-1 text-sm"
                      : "text-muted-foreground flex-1 text-sm line-through"
                  }
                >
                  {c.name}
                </span>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${c.name}`}
                      onClick={() => setRenaming(c.id)}
                    >
                      <Pencil />
                    </Button>
                    <ConfirmButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={c.active ? `Hide ${c.name}` : `Show ${c.name}`}
                      title={c.active ? `Hide “${c.name}”?` : `Show “${c.name}” again?`}
                      description={
                        c.active
                          ? "It stays on the expenses already entered, but can't be picked for new ones."
                          : undefined
                      }
                      confirmLabel={c.active ? "Hide" : "Show"}
                      action={setCategoryActiveAction.bind(null, c.id, !c.active)}
                    >
                      {c.active ? <EyeOff /> : <Eye />}
                    </ConfirmButton>
                  </>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      {canManage ? <CategoryForm /> : null}
    </div>
  );
}

function CategoryForm({
  category,
  onDone,
}: {
  category?: ExpenseCategoryRow;
  onDone?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useFormAction(saveCategoryAction, null);
  const e = useActionToast(state, () => {
    form.current?.reset();
    onDone?.();
  });
  return (
    <form ref={form} {...action} noValidate className="flex flex-1 items-start gap-2">
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <div className="flex-1">
        <Input
          name="name"
          aria-label={category ? "Category name" : "New category"}
          placeholder={category ? undefined : "New category, e.g. Insurance"}
          defaultValue={category?.name ?? ""}
          aria-invalid={e.name ? true : undefined}
          className="h-10"
        />
        {e.name ? <p className="text-destructive mt-1 text-xs">{e.name}</p> : null}
      </div>
      <Button type="submit" variant="outline" className="h-10" disabled={pending}>
        {category ? "Save" : "Add"}
      </Button>
      {category ? (
        <Button type="button" variant="ghost" className="h-10" onClick={onDone}>
          Cancel
        </Button>
      ) : null}
    </form>
  );
}
