"use client";

import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { attachCustomerAction } from "@/modules/orders/actions";

/**
 * "Add customer details" on an order with no customer, or one missing an email / phone (e.g. a
 * POS sale where the customer shared their email later). Saving links the purchase to them and
 * puts its Passport stamps on their card.
 */
export function AttachCustomerForm({
  orderId,
  email,
  phone,
  hasCustomer,
}: {
  orderId: string;
  email: string | null;
  phone: string | null;
  hasCustomer: boolean;
}) {
  const [state, action, pending] = useFormAction(attachCustomerAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} noValidate className="flex flex-col gap-3 border-t pt-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <p className="text-sm font-medium">
          {hasCustomer ? "Complete customer details" : "Add customer for Passport"}
        </p>
        <p className="text-muted-foreground text-xs">
          With their email, this purchase&apos;s stamps also show in their online account.
        </p>
      </div>
      {email ? null : (
        <Field label="Email" htmlFor="attach-email" error={e.email}>
          <Input id="attach-email" name="email" type="email" autoComplete="off" className="h-10" />
        </Field>
      )}
      {phone ? null : (
        <Field label="Mobile" htmlFor="attach-phone" error={e.phone}>
          <Input
            id="attach-phone"
            name="phone"
            type="tel"
            placeholder="050 123 4567"
            className="h-10"
          />
        </Field>
      )}
      {hasCustomer ? null : (
        <Field label="Name (optional)" htmlFor="attach-name" error={e.name}>
          <Input id="attach-name" name="name" className="h-10" />
        </Field>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
