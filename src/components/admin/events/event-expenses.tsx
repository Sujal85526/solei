"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip, Receipt, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { addExpenseAction, deleteExpenseAction } from "@/modules/events/actions";
import {
  RECEIPT_TYPES,
  expenseCategories,
  expenseCategoryLabels,
  type ExpenseCategory,
} from "@/modules/events/schema";
import { uploadEventFile } from "./upload";

type Expense = {
  id: string;
  category: ExpenseCategory;
  amount_fils: number;
  note: string | null;
  incurred_on: string;
  receiptUrl?: string | null;
};

export function EventExpenses({
  eventId,
  expenses,
  defaultDate,
  canManage,
  participationFeeFils,
}: {
  eventId: string;
  expenses: Expense[];
  defaultDate: string;
  canManage: boolean;
  participationFeeFils: number;
}) {
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [receipt, setReceipt] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, action, pending] = useFormAction(addExpenseAction, null);
  const e = useActionToast(state, () => {
    form.current?.reset();
    setReceipt(null);
  });

  const total = expenses.reduce((s, x) => s + x.amount_fils, 0);
  const byCategory = expenseCategories
    .map((c) => ({
      c,
      fils: expenses.filter((x) => x.category === c).reduce((s, x) => s + x.amount_fils, 0),
    }))
    .filter((x) => x.fils > 0);

  async function attach(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const r = await uploadEventFile(eventId, "receipts", file, RECEIPT_TYPES);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (!r.ok) return void toast.error(r.error);
    setReceipt({ path: r.path, name: file.name });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Expenses</p>
          <p className="numeric text-xl font-semibold" data-testid="expenses-total">
            {formatAED(total)}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Participation fee</p>
          <p className="numeric text-xl font-semibold">{formatAED(participationFeeFils)}</p>
        </div>
        <div className="bg-muted/50 col-span-2 rounded-lg p-3 sm:col-span-1">
          <p className="text-muted-foreground text-xs">Total event cost</p>
          <p className="numeric text-xl font-semibold">{formatAED(total + participationFeeFils)}</p>
        </div>
      </div>
      {byCategory.length > 1 ? (
        <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {byCategory.map((x) => (
            <li key={x.c}>
              {expenseCategoryLabels[x.c]}:{" "}
              <span className="numeric text-foreground">{formatAED(x.fils)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {expenses.length ? (
        <ul className="divide-y rounded-lg border" data-testid="expense-list">
          {expenses.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {expenseCategoryLabels[x.category]}
                  {x.note ? (
                    <span className="text-muted-foreground font-normal"> · {x.note}</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatBusinessDate(x.incurred_on, { day: "numeric", month: "short" })}
                  {x.receiptUrl ? (
                    <>
                      {" · "}
                      <a
                        href={x.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-burgundy inline-flex items-center gap-0.5 underline-offset-4 hover:underline"
                      >
                        <Receipt className="size-3" aria-hidden /> Receipt
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <span className="numeric text-sm font-semibold">{formatAED(x.amount_fils)}</span>
              {canManage ? (
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete expense"
                  title="Delete this expense?"
                  description="Its receipt is deleted too."
                  confirmLabel="Delete"
                  destructive
                  action={deleteExpenseAction.bind(null, x.id)}
                >
                  <Trash2 />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No expenses yet.</p>
      )}

      {canManage ? (
        <form
          ref={form}
          {...action}
          noValidate
          className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2 sm:p-4"
        >
          <p className="text-foreground text-sm font-semibold sm:col-span-2">Add an expense</p>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="receiptPath" value={receipt?.path ?? ""} />
          <Field label="Category" htmlFor="category" error={e.category} required>
            <NativeSelect id="category" name="category" defaultValue="" className="[&_select]:h-11">
              <option value="" disabled>
                Choose…
              </option>
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabels[c]}
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
              className="numeric h-11"
            />
          </Field>
          <Field label="Date" htmlFor="incurredOn" error={e.incurredOn} required>
            <Input
              id="incurredOn"
              name="incurredOn"
              type="date"
              defaultValue={defaultDate}
              className="h-11"
            />
          </Field>
          <Field label="Note" htmlFor="note" error={e.note}>
            <Input id="note" name="note" placeholder="e.g. Van hire, 2 days" className="h-11" />
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            {receipt ? (
              <span className="bg-muted inline-flex h-11 max-w-full items-center gap-2 rounded-md px-3 text-sm">
                <Paperclip className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{receipt.name}</span>
                <button type="button" aria-label="Remove receipt" onClick={() => setReceipt(null)}>
                  <X className="size-4" />
                </button>
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />}
                {uploading ? "Uploading…" : "Attach receipt"}
              </Button>
            )}
            <Button
              type="submit"
              size="lg"
              className="ms-auto h-11"
              disabled={pending || uploading}
            >
              {pending ? "Saving…" : "Add expense"}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={RECEIPT_TYPES.join(",")}
            hidden
            data-testid="receipt-upload"
            onChange={(ev) => attach(ev.target.files?.[0])}
          />
        </form>
      ) : null}
    </div>
  );
}
