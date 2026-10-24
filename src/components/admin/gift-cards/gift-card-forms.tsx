"use client";

import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { issueGiftCardAction, saveGiftCardSettingsAction } from "@/modules/gift-cards/actions";
import { amountsText, type GiftCardSettings } from "@/modules/gift-cards/schema";

/** Issue a card by hand: live at once, optionally emailed to the recipient. */
export function IssueGiftCardForm({ expiryMonths }: { expiryMonths: number | null }) {
  const [state, action, pending] = useFormAction(issueGiftCardAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Amount (AED)"
            htmlFor="amount"
            error={e.amount}
            hint={expiryMonths ? `Valid for ${expiryMonths} months` : "Never expires"}
            required
          >
            <Input id="amount" name="amount" inputMode="decimal" className="numeric h-11" />
          </Field>
          <Field
            label="Note (staff only)"
            htmlFor="note"
            error={e.note}
            hint="Why it was issued, e.g. Instagram giveaway"
          >
            <Input id="note" name="note" className="h-11" />
          </Field>
          <Field label="Recipient name" htmlFor="recipientName" error={e.recipientName}>
            <Input id="recipientName" name="recipientName" className="h-11" />
          </Field>
          <Field label="Recipient email" htmlFor="recipientEmail" error={e.recipientEmail}>
            <Input id="recipientEmail" name="recipientEmail" type="email" className="h-11" />
          </Field>
          <Field
            label="Message"
            htmlFor="message"
            error={e.message}
            hint="Shown in the email"
            className="sm:col-span-2"
          >
            <Textarea id="message" name="message" rows={2} maxLength={300} />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            name="sendEmail"
            defaultChecked
            className="accent-primary size-4"
          />
          Email the gift card to the recipient now
        </label>
      </section>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Issuing…" : "Issue gift card"}
      </Button>
    </form>
  );
}

/** Owner rules: on/off, the amounts sold online, expiry and whether the till takes them. */
export function GiftCardSettingsForm({ settings }: { settings: GiftCardSettings }) {
  const [state, action, pending] = useFormAction(saveGiftCardSettingsAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      <section className="bg-card flex flex-col gap-5 rounded-xl border p-6">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            Sell gift cards on the website
            <span className="text-muted-foreground block text-xs">
              Off hides the purchase form; cards already sold can still be spent.
            </span>
          </span>
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Amounts (AED)"
            htmlFor="amounts"
            error={e.amounts}
            hint="Separated by commas, e.g. 100, 200, 300, 500"
            required
          >
            <Input
              id="amounts"
              name="amounts"
              defaultValue={amountsText(settings.amountsFils)}
              className="numeric h-11"
            />
          </Field>
          <Field
            label="Valid for (months)"
            htmlFor="expiryMonths"
            error={e.expiryMonths}
            hint="From the day it's bought; empty = never expires"
          >
            <Input
              id="expiryMonths"
              name="expiryMonths"
              inputMode="numeric"
              defaultValue={settings.expiryMonths ?? ""}
              className="numeric h-11"
            />
          </Field>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="atPos"
            defaultChecked={settings.atPos}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            Also accept gift cards at the event till
            <span className="text-muted-foreground block text-xs">
              Off = website only. The till needs a connection to check a card.
            </span>
          </span>
        </label>
      </section>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
