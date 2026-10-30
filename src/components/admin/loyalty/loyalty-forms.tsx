"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Gift, Minus, Plus, Stamp } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, fieldAria } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import {
  adjustStampsAction,
  issuePassportAction,
  redeemRewardAction,
} from "@/modules/loyalty/actions";

export function IssuePassportButton({ customerId }: { customerId: string }) {
  return (
    <ConfirmButton
      size="sm"
      title="Issue a passport now?"
      description="Use this when the customer asks for their Solei Passport before it is issued automatically."
      confirmLabel="Issue passport"
      action={() => issuePassportAction(customerId, "request")}
    >
      <Stamp /> Issue passport
    </ConfirmButton>
  );
}

export function AdjustStampsDialog({
  customerId,
  destinations,
  maxRemovable,
}: {
  customerId: string;
  destinations: { id: string; name: string }[];
  maxRemovable: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [state, formProps, pending] = useFormAction(adjustStampsAction, null);
  const errors = useActionToast(
    state,
    useCallback(() => setOpen(false), []),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus /> Adjust stamps
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add or remove stamps</DialogTitle>
          <DialogDescription>
            Manual changes are kept in the ledger with your name and the reason.
          </DialogDescription>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="customerId" value={customerId} />
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Add or remove</legend>
            {(["add", "remove"] as const).map((d) => (
              <label
                key={d}
                className="has-[:checked]:border-burgundy has-[:checked]:bg-burgundy/5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-medium"
              >
                <input
                  type="radio"
                  name="direction"
                  value={d}
                  checked={direction === d}
                  onChange={() => setDirection(d)}
                  className="sr-only"
                />
                {d === "add" ? <Plus className="size-4" /> : <Minus className="size-4" />}
                {d === "add" ? "Add" : "Remove"}
              </label>
            ))}
          </fieldset>
          <Field
            label="Stamps"
            htmlFor="stamps"
            error={errors.stamps}
            hint={
              direction === "remove"
                ? maxRemovable > 0
                  ? `Up to ${maxRemovable} (an unused reward is withdrawn first if needed).`
                  : "There are no stamps to remove."
                : "Between 1 and 100."
            }
          >
            <Input
              {...fieldAria("stamps", errors.stamps)}
              type="number"
              inputMode="numeric"
              min={1}
              max={direction === "remove" ? Math.max(1, maxRemovable) : 100}
              defaultValue={1}
              className="h-11"
            />
          </Field>
          {direction === "add" ? (
            <Field
              label="Destination sticker"
              htmlFor="destinationId"
              error={errors.destinationId}
              hint="Optional — which destination the stamp shows."
            >
              <NativeSelect
                {...fieldAria("destinationId", errors.destinationId)}
                defaultValue=""
                className="[&_button]:h-11"
              >
                <option value="">No destination</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Reason" htmlFor="reason" error={errors.reason} required>
            <Textarea
              {...fieldAria("reason", errors.reason)}
              rows={2}
              placeholder="e.g. Paper passport from the Yas pop-up"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : direction === "add" ? "Add stamps" : "Remove stamps"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type RedeemOption = {
  variant_id: string;
  product_name: string;
  variant_label: string;
  price_fils: number;
  on_hand: number | null;
};

export function RedeemRewardDialog({
  customerId,
  reward,
  options,
}: {
  customerId: string;
  reward: { id: string; label: string; isItem: boolean; valueText: string | null };
  options: RedeemOption[];
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [state, formProps, pending] = useFormAction(redeemRewardAction, null);
  const errors = useActionToast(
    state,
    useCallback((d: { orderId: string; orderNumber: string }) => setDone(d), []),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDone(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Gift /> Redeem
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem {reward.label}</DialogTitle>
          <DialogDescription>
            {reward.isItem
              ? "Creates a zero-priced order with the chosen product and takes it out of stock. Add an order number to put it on an open order instead."
              : `Marks ${reward.valueText ?? "the reward"} as used on an order — apply the discount on that order yourself.`}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              Redeemed on order{" "}
              <Link href={`/admin/orders/${done.orderId}`} className="font-mono underline">
                {done.orderNumber}
              </Link>
              .
            </p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form {...formProps} className="flex flex-col gap-4" noValidate>
            <input type="hidden" name="rewardId" value={reward.id} />
            <input type="hidden" name="customerId" value={customerId} />
            {reward.isItem ? (
              <Field label="Product" htmlFor="variantId" error={errors.variantId} required>
                {options.length ? (
                  <NativeSelect
                    {...fieldAria("variantId", errors.variantId)}
                    defaultValue={options[0]?.variant_id}
                    className="[&_button]:h-11"
                  >
                    {options.map((o) => (
                      <option key={o.variant_id} value={o.variant_id}>
                        {o.product_name}
                        {o.variant_label ? ` · ${o.variant_label}` : ""} ({formatAED(o.price_fils)}
                        {o.on_hand !== null ? ` · ${o.on_hand} in stock` : ""})
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <p className="text-destructive text-sm">
                    No active products match this reward. Check Admin → Loyalty → Settings.
                  </p>
                )}
              </Field>
            ) : null}
            <Field
              label={reward.isItem ? "Add to order (optional)" : "Order number"}
              htmlFor="orderNumber"
              error={errors.orderNumber}
              hint={reward.isItem ? "Leave empty to create a new reward order." : undefined}
              required={!reward.isItem}
            >
              <Input
                {...fieldAria("orderNumber", errors.orderNumber)}
                placeholder="SOL-001234"
                autoCapitalize="characters"
                className="h-11 font-mono"
              />
            </Field>
            <Field label="Note" htmlFor="note" error={errors.note}>
              <Input {...fieldAria("note", errors.note)} className="h-11" />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={pending || (reward.isItem && !options.length)}>
                {pending ? "Redeeming…" : "Redeem reward"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
