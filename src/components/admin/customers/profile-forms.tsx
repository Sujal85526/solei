"use client";

import { useCallback, useState } from "react";
import { Copy, Mail, MessageCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, fieldAria } from "@/components/admin/field";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatPhone, waNumber } from "@/lib/phone";
import {
  deleteCustomerAction,
  recordConsentAction,
  recordOptOutAction,
  updateContactAction,
  updateNotesAction,
} from "@/modules/customers/actions";
import {
  channelLabel,
  emirateLabels,
  emirates,
  marketingChannels,
  type CustomerAddress,
} from "@/modules/customers/schema";

type Contact = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  emirate: string | null;
  address: CustomerAddress;
};

export function EditContactDialog({ customer }: { customer: Contact }) {
  const [open, setOpen] = useState(false);
  const [state, formProps, pending] = useFormAction(updateContactAction, null);
  const errors = useActionToast(
    state,
    useCallback(() => setOpen(false), []),
  );
  const a = customer.address;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil /> Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit contact details</DialogTitle>
          <DialogDescription>
            The phone number identifies the customer — it must be unique.
          </DialogDescription>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={customer.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={errors.name} className="sm:col-span-2">
              <Input
                {...fieldAria("name", errors.name)}
                defaultValue={customer.name ?? ""}
                className="h-11"
              />
            </Field>
            <Field
              label="Phone"
              htmlFor="phone"
              error={errors.phone}
              hint="Any format, e.g. 050 123 4567"
            >
              <Input
                {...fieldAria("phone", errors.phone)}
                type="tel"
                defaultValue={customer.phone ?? ""}
                className="h-11"
              />
            </Field>
            <Field
              label="Email"
              htmlFor="email"
              error={errors.email}
              required
              hint="Their Solei Passport links to this email."
            >
              <Input
                {...fieldAria("email", errors.email)}
                type="email"
                defaultValue={customer.email ?? ""}
                className="h-11"
              />
            </Field>
            <Field
              label="Street address"
              htmlFor="line1"
              error={errors.line1}
              className="sm:col-span-2"
            >
              <Input
                {...fieldAria("line1", errors.line1)}
                defaultValue={a.line1 ?? ""}
                className="h-11"
              />
            </Field>
            <Field
              label="Apartment, villa, building"
              htmlFor="line2"
              error={errors.line2}
              className="sm:col-span-2"
            >
              <Input
                {...fieldAria("line2", errors.line2)}
                defaultValue={a.line2 ?? ""}
                className="h-11"
              />
            </Field>
            <Field label="Area" htmlFor="area" error={errors.area}>
              <Input
                {...fieldAria("area", errors.area)}
                defaultValue={a.area ?? ""}
                className="h-11"
              />
            </Field>
            <Field label="City" htmlFor="city" error={errors.city}>
              <Input
                {...fieldAria("city", errors.city)}
                defaultValue={a.city ?? ""}
                className="h-11"
              />
            </Field>
            <Field label="Emirate" htmlFor="emirate" error={errors.emirate}>
              <NativeSelect
                {...fieldAria("emirate", errors.emirate)}
                defaultValue={customer.emirate ?? ""}
                className="[&_select]:h-11"
              >
                <option value="">Not given</option>
                {emirates.map((e) => (
                  <option key={e} value={e}>
                    {emirateLabels[e]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NotesForm({ id, notes }: { id: string; notes: string | null }) {
  const [state, formProps, pending] = useFormAction(updateNotesAction, null);
  const errors = useActionToast(state);
  return (
    <form {...formProps} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <Field label="Notes" htmlFor="notes" error={errors.notes} hint="Only staff see these.">
        <Textarea
          {...fieldAria("notes", errors.notes)}
          defaultValue={notes ?? ""}
          rows={4}
          placeholder="Preferences, sizes, gifting dates…"
        />
      </Field>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      </div>
    </form>
  );
}

export function RecordConsentDialog({
  id,
  hasPhone,
  hasEmail,
  current,
}: {
  id: string;
  hasPhone: boolean;
  hasEmail: boolean;
  current: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formProps, pending] = useFormAction(recordConsentAction, null);
  const errors = useActionToast(
    state,
    useCallback(() => setOpen(false), []),
  );
  const available = { email: hasEmail, whatsapp: hasPhone };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Record consent</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record marketing consent</DialogTitle>
          <DialogDescription>
            Only when the customer has agreed to hear from Solei. The time is recorded.
          </DialogDescription>
        </DialogHeader>
        <form {...formProps} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="id" value={id} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Channels</legend>
            {marketingChannels.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked={current.includes(c) || (current.length === 0 && available[c])}
                  disabled={!available[c]}
                  className="accent-burgundy size-5"
                />
                {channelLabel(c)}
                {!available[c] ? (
                  <span className="text-muted-foreground text-xs">
                    (add {c === "email" ? "an email" : "a phone"} first)
                  </span>
                ) : null}
              </label>
            ))}
            {errors.channels ? <p className="text-destructive text-sm">{errors.channels}</p> : null}
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Record consent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OptOutButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      size="sm"
      title="Record opt-out?"
      description="The customer will be excluded from all marketing (email and WhatsApp). Order and booking messages still go out."
      confirmLabel="Record opt-out"
      destructive
      action={() => recordOptOutAction(id)}
    >
      Record opt-out
    </ConfirmButton>
  );
}

export function DeleteCustomerButton({ id, name }: { id: string; name: string }) {
  return (
    <ConfirmButton
      size="sm"
      title={`Delete ${name}?`}
      description="This removes the customer, their Passport stickers and their website login, and can't be undone. Their past orders stay in your records, but are no longer linked to them."
      confirmLabel="Delete customer"
      destructive
      variant="outline"
      action={() => deleteCustomerAction(id)}
    >
      Delete customer
    </ConfirmButton>
  );
}

/** WhatsApp, email and copy-phone shortcuts. */
export function QuickActions({
  phone,
  email,
  name,
}: {
  phone: string | null;
  email: string | null;
  name: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {phone ? (
        <a
          href={`https://wa.me/${waNumber(phone)}`}
          aria-label={`WhatsApp ${name ?? formatPhone(phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <MessageCircle /> WhatsApp
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <Mail /> Email
        </a>
      ) : null}
      {phone ? (
        <Button
          variant="outline"
          size="lg"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(phone);
              toast.success(`Copied ${formatPhone(phone)}`);
            } catch {
              toast.error("Couldn't copy — long-press the number instead.");
            }
          }}
        >
          <Copy /> Copy phone
        </Button>
      ) : null}
    </div>
  );
}
