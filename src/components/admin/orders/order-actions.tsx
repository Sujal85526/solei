"use client";

import { useCallback, useState } from "react";
import { Ban, Banknote, RotateCcw, Undo2 } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import {
  cancelOrderAction,
  changeStatusAction,
  recordPaymentAction,
  recordRefundAction,
} from "@/modules/orders/actions";
import {
  MANUAL_PAYMENT_METHODS,
  ORDER_STATUS_ACTIONS,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type PaymentMethod,
} from "@/modules/orders/status";

type Mode = { kind: "status"; status: OrderStatus } | { kind: "payment" | "refund" | "cancel" };

export type OrderActionsProps = {
  orderId: string;
  number: string;
  status: OrderStatus;
  forward: OrderStatus[];
  back: OrderStatus[];
  outstandingFils: number;
  refundableFils: number;
  hasStock: boolean;
  trackingNumber: string | null;
  courier: string | null;
  can: { update: boolean; pay: boolean; refund: boolean; cancel: boolean };
};

const filsToInput = (f: number) => (f / 100).toFixed(2);

export function OrderActions(p: OrderActionsProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const close = useCallback(() => setMode(null), []);
  const cancelled = p.status === "cancelled";
  const showPay = p.can.pay && !cancelled && p.outstandingFils > 0;
  const showRefund = p.can.refund && p.refundableFils > 0;
  const showCancel = p.can.cancel && !cancelled;
  const statusMoves = p.can.update ? p.forward : [];

  if (!statusMoves.length && !showPay && !showRefund && !showCancel && !p.back.length) return null;

  return (
    <>
      <div className="flex flex-col gap-3">
        {statusMoves.length ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {statusMoves.map((s, i) => (
              <Button
                key={s}
                size="lg"
                variant={i === 0 ? "default" : "outline"}
                onClick={() => setMode({ kind: "status", status: s })}
              >
                {ORDER_STATUS_ACTIONS[s]}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {showPay ? (
            <Button variant="outline" onClick={() => setMode({ kind: "payment" })}>
              <Banknote /> Record payment
            </Button>
          ) : null}
          {showRefund ? (
            <Button variant="outline" onClick={() => setMode({ kind: "refund" })}>
              <Undo2 /> Record refund
            </Button>
          ) : null}
          {p.can.update && p.back.length
            ? p.back.map((s) => (
                <Button
                  key={s}
                  variant="ghost"
                  onClick={() => setMode({ kind: "status", status: s })}
                >
                  <RotateCcw /> {ORDER_STATUS_ACTIONS[s]}
                </Button>
              ))
            : null}
          {showCancel ? (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setMode({ kind: "cancel" })}
            >
              <Ban /> Cancel order
            </Button>
          ) : null}
        </div>
      </div>
      {mode?.kind === "status" ? (
        <StatusDialog key={mode.status} {...p} to={mode.status} onClose={close} />
      ) : mode?.kind === "payment" ? (
        <PaymentDialog {...p} onClose={close} />
      ) : mode?.kind === "refund" ? (
        <RefundDialog {...p} onClose={close} />
      ) : mode?.kind === "cancel" ? (
        <CancelDialog {...p} onClose={close} />
      ) : null}
    </>
  );
}

function Shell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

type DialogProps = OrderActionsProps & { onClose: () => void };

function StatusDialog({
  orderId,
  number,
  to,
  trackingNumber,
  courier,
  onClose,
}: DialogProps & { to: OrderStatus }) {
  const [state, action, pending] = useFormAction(changeStatusAction, null);
  const e = useActionToast(state, onClose);
  const dispatched = to === "dispatched";
  return (
    <Shell
      title={`${ORDER_STATUS_ACTIONS[to]} — ${number}`}
      description={
        to === "preparing" || dispatched || to === "delivered"
          ? `The customer gets the “${ORDER_STATUS_LABELS[to]}” email if it's enabled.`
          : undefined
      }
      onClose={onClose}
    >
      <form {...action} className="grid gap-4" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="status" value={to} />
        {dispatched ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tracking number" htmlFor="trackingNumber" error={e.trackingNumber}>
              <Input
                id="trackingNumber"
                name="trackingNumber"
                defaultValue={trackingNumber ?? ""}
                autoComplete="off"
                className="h-11"
              />
            </Field>
            <Field label="Courier" htmlFor="courier" error={e.courier}>
              <Input
                id="courier"
                name="courier"
                defaultValue={courier ?? ""}
                placeholder="e.g. Aramex"
                className="h-11"
              />
            </Field>
          </div>
        ) : null}
        <Field label="Note (staff only)" htmlFor="note" error={e.note}>
          <Input id="note" name="note" className="h-11" />
        </Field>
        <DialogFooter>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : ORDER_STATUS_ACTIONS[to]}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}

function PaymentDialog({ orderId, outstandingFils, onClose }: DialogProps) {
  const [state, action, pending] = useFormAction(recordPaymentAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Shell
      title="Record payment"
      description={`Outstanding: ${formatAED(outstandingFils, { alwaysShowFils: true })}. Online payments are recorded automatically.`}
      onClose={onClose}
    >
      <form {...action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <Field label="Amount (AED)" htmlFor="amount" error={e.amount} required>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            defaultValue={filsToInput(outstandingFils)}
            className="numeric h-11"
          />
        </Field>
        <Field label="Method" htmlFor="method" error={e.method} required>
          <NativeSelect id="method" name="method" defaultValue="cash" className="[&_button]:h-11">
            {MANUAL_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Reference"
          htmlFor="reference"
          error={e.reference}
          hint="Receipt or transfer number"
          className="sm:col-span-2"
        >
          <Input id="reference" name="reference" autoComplete="off" className="h-11" />
        </Field>
        <Field label="Note" htmlFor="payNote" error={e.note} className="sm:col-span-2">
          <Input id="payNote" name="note" className="h-11" />
        </Field>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}

const REFUND_METHODS: PaymentMethod[] = [
  "cash",
  "bank_transfer",
  "card_terminal",
  "soft_pos",
  "online_card",
  // Back onto the gift card the order was paid with (the database credits the card).
  "gift_card",
  // Back as points, at the rate they were spent.
  "loyalty_points",
  "other",
];

function RefundDialog({ orderId, refundableFils, onClose }: DialogProps) {
  const [state, action, pending] = useFormAction(recordRefundAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Shell
      title="Record refund"
      description={`Record money already returned to the customer (up to ${formatAED(refundableFils, { alwaysShowFils: true })}). Card refunds are made in the payment provider's dashboard first.`}
      onClose={onClose}
    >
      <form {...action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <Field label="Amount (AED)" htmlFor="refundAmount" error={e.amount} required>
          <Input
            id="refundAmount"
            name="amount"
            inputMode="decimal"
            defaultValue={filsToInput(refundableFils)}
            className="numeric h-11"
          />
        </Field>
        <Field label="Refunded by" htmlFor="refundMethod" error={e.method} required>
          <NativeSelect
            id="refundMethod"
            name="method"
            defaultValue="cash"
            className="[&_button]:h-11"
          >
            {REFUND_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Reason"
          htmlFor="refundReason"
          error={e.reason}
          required
          className="sm:col-span-2"
        >
          <Input
            id="refundReason"
            name="reason"
            placeholder="e.g. Bottle arrived damaged"
            className="h-11"
          />
        </Field>
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Record refund"}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}

function CancelDialog({ orderId, number, hasStock, refundableFils, onClose }: DialogProps) {
  const [state, action, pending] = useFormAction(cancelOrderAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Shell
      title={`Cancel ${number}?`}
      description={
        refundableFils > 0
          ? `This can't be undone. ${formatAED(refundableFils)} was paid — record the refund separately.`
          : "This can't be undone."
      }
      onClose={onClose}
    >
      <form {...action} className="grid gap-4" noValidate>
        <input type="hidden" name="orderId" value={orderId} />
        <Field label="Reason" htmlFor="cancelReason" error={e.reason} required>
          <Textarea
            id="cancelReason"
            name="reason"
            rows={2}
            placeholder="e.g. Customer changed their mind"
          />
        </Field>
        {hasStock ? (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="restock"
              defaultChecked
              className="accent-burgundy mt-0.5 size-5"
            />
            <span>
              Return the items to stock
              <span className="text-muted-foreground block text-xs">
                Untick if the goods are lost or damaged.
              </span>
            </span>
          </label>
        ) : null}
        <DialogFooter>
          <Button type="submit" size="lg" variant="destructive" disabled={pending}>
            {pending ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </form>
    </Shell>
  );
}
