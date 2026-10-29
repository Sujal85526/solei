"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { CustomerPicker } from "@/components/admin/customers/customer-picker";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import type { CustomerOption } from "@/modules/customers/queries";
import {
  deleteFeedbackAction,
  saveFeedbackAction,
  setFeedbackStatusAction,
} from "@/modules/feedback/actions";
import {
  feedbackKinds,
  feedbackStatuses,
  kindBadgeVariant,
  kindLabels,
  stars,
  statusBadgeVariant,
  statusLabels,
  type FeedbackEntry,
  type FeedbackStatus,
} from "@/modules/feedback/schema";

type Person = { id: string; name: string; active: boolean };
type OrderOption = { id: string; number: string };

/**
 * Log a complaint / suggestion / compliment, or update one (status, who handles it, what was
 * done). From a customer's page the customer is fixed; from the log page staff find them.
 */
export function FeedbackDialog({
  entry,
  customer,
  orders = [],
  staff,
}: {
  entry?: FeedbackEntry;
  customer?: { id: string; name: string | null };
  orders?: OrderOption[];
  staff: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CustomerOption | null>(null);
  const [state, action, pending] = useFormAction(saveFeedbackAction, null);
  const e = useActionToast(state, () => {
    setOpen(false);
    setPicked(null);
  });
  const customerId = entry?.customerId ?? customer?.id ?? picked?.id ?? "";
  return (
    <>
      {entry ? (
        <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <MessageSquarePlus /> Log feedback
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{entry ? "Feedback" : "Log feedback"}</DialogTitle>
          </DialogHeader>
          <form {...action} className="grid gap-4" noValidate>
            {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
            <input type="hidden" name="customerId" value={customerId} />
            {entry || customer ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Customer: </span>
                {entry?.customerName ?? customer?.name ?? "—"}
                {entry?.orderNumber ? ` · order ${entry.orderNumber}` : ""}
              </p>
            ) : picked ? (
              <p className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Customer: </span>
                  {picked.name ?? picked.email ?? picked.phone}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </p>
            ) : (
              <div>
                <CustomerPicker onSelect={setPicked} canCreate={false} />
                {e.customerId ? (
                  <p className="text-destructive mt-1 text-xs">{e.customerId}</p>
                ) : null}
              </div>
            )}
            {!entry && orders.length ? (
              <Field label="About an order" htmlFor="fbOrder">
                <NativeSelect id="fbOrder" name="orderId" className="[&_select]:h-11">
                  <option value="">No particular order</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.number}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kind" htmlFor="fbKind" error={e.kind} required>
                <NativeSelect
                  id="fbKind"
                  name="kind"
                  defaultValue={entry?.kind ?? "complaint"}
                  className="[&_select]:h-11"
                >
                  {feedbackKinds.map((k) => (
                    <option key={k} value={k}>
                      {kindLabels[k]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Status" htmlFor="fbStatus">
                <NativeSelect
                  id="fbStatus"
                  name="status"
                  defaultValue={entry?.status ?? "open"}
                  className="[&_select]:h-11"
                >
                  {feedbackStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="What they said" htmlFor="fbMessage" error={e.message} required>
              <Textarea
                id="fbMessage"
                name="message"
                rows={4}
                maxLength={2000}
                defaultValue={entry?.message ?? ""}
              />
            </Field>
            <Field label="Handled by" htmlFor="fbAssigned">
              <NativeSelect
                id="fbAssigned"
                name="assignedTo"
                defaultValue={entry?.assignedTo ?? ""}
                className="[&_select]:h-11"
              >
                <option value="">Nobody yet</option>
                {staff
                  .filter((p) => p.active || p.id === entry?.assignedTo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
            <Field
              label="What we did"
              htmlFor="fbResolution"
              error={e.resolution}
              hint="e.g. replaced the bottle, refunded, passed the idea to the owner"
            >
              <Textarea
                id="fbResolution"
                name="resolution"
                rows={2}
                maxLength={2000}
                defaultValue={entry?.resolution ?? ""}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusSelect({ id, status }: { id: string; status: FeedbackStatus }) {
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      aria-label="Status"
      defaultValue={status}
      disabled={pending}
      className="[&_select]:h-9 [&_select]:text-xs"
      onChange={(ev) => {
        const next = ev.target.value as FeedbackStatus;
        start(async () => {
          const res = await setFeedbackStatusAction(id, next);
          if (!res.ok) toast.error(res.error);
        });
      }}
    >
      {feedbackStatuses.map((s) => (
        <option key={s} value={s}>
          {statusLabels[s]}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Entries with their badges; staff with customers.manage change status, edit or remove. */
export function FeedbackList({
  entries,
  staff,
  canManage,
  showCustomer,
}: {
  entries: FeedbackEntry[];
  staff: Person[];
  canManage: boolean;
  showCustomer?: boolean;
}) {
  const names = new Map(staff.map((p) => [p.id, p.name]));
  return (
    <ul className="-mx-5 divide-y border-y text-sm sm:-mx-6" aria-label="Feedback">
      {entries.map((f) => (
        <li key={f.id} className="flex flex-col gap-2 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kindBadgeVariant[f.kind]}>{kindLabels[f.kind]}</Badge>
            {canManage ? null : (
              <Badge variant={statusBadgeVariant[f.status]}>{statusLabels[f.status]}</Badge>
            )}
            {f.rating ? (
              <span className="text-gold-ink text-xs" aria-label={`${f.rating} out of 5`}>
                {stars(f.rating)}
              </span>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {formatBusinessDate(f.createdAt)}
              {f.source === "email" ? " · from the feedback email" : ""}
            </span>
            {canManage ? (
              <span className="ms-auto flex items-center gap-1">
                <StatusSelect id={f.id} status={f.status} />
                <FeedbackDialog entry={f} staff={staff} />
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  destructive
                  aria-label="Remove"
                  title="Remove this entry?"
                  confirmLabel="Remove"
                  action={() => deleteFeedbackAction(f.id)}
                >
                  <Trash2 />
                </ConfirmButton>
              </span>
            ) : null}
          </div>
          {showCustomer && (f.customerId || f.orderNumber) ? (
            <p className="font-medium">
              {f.customerId ? (
                <Link href={`/admin/customers/${f.customerId}`} className="hover:underline">
                  {f.customerName ?? "Customer"}
                </Link>
              ) : null}
              {f.orderId && f.orderNumber ? (
                <>
                  {f.customerId ? " · " : ""}
                  <Link href={`/admin/orders/${f.orderId}`} className="hover:underline">
                    {f.orderNumber}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="whitespace-pre-wrap">{f.message}</p>
          {f.assignedTo || f.resolution ? (
            <p className="text-muted-foreground text-xs">
              {f.assignedTo
                ? `Handled by ${names.get(f.assignedTo) ?? "a former staff member"}`
                : ""}
              {f.assignedTo && f.resolution ? " · " : ""}
              {f.resolution ? `What we did: ${f.resolution}` : ""}
              {f.resolvedAt ? ` (resolved ${formatBusinessDate(f.resolvedAt)})` : ""}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
