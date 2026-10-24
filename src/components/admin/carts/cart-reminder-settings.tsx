"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { runCartRemindersAction, saveCartReminderSettingsAction } from "@/modules/carts/actions";
import type { CartReminderSettings } from "@/modules/carts/schema";

/** Owner rules for bag reminders, plus a button to send the ones due now. */
export function CartReminderSettingsForm({ settings }: { settings: CartReminderSettings }) {
  const [state, action, pending] = useFormAction(saveCartReminderSettingsAction, null);
  const e = useActionToast(state);
  const [sending, start] = useTransition();
  return (
    <div className="flex flex-col gap-5">
      <form {...action} noValidate className="flex flex-col gap-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            Send bag reminders
            <span className="text-muted-foreground block text-xs">
              To signed-in customers who leave items in their bag.
            </span>
          </span>
        </label>
        <Field
          label="First reminder after (hours)"
          htmlFor="firstHours"
          error={e.firstHours}
          hint="Since they last changed their bag"
          required
        >
          <Input
            id="firstHours"
            name="firstHours"
            inputMode="numeric"
            defaultValue={settings.firstHours}
            className="numeric h-11"
          />
        </Field>
        <Field
          label="Second reminder after (hours)"
          htmlFor="secondHours"
          error={e.secondHours}
          hint="Empty = one reminder only. e.g. 48 for two days"
        >
          <Input
            id="secondHours"
            name="secondHours"
            inputMode="numeric"
            defaultValue={settings.secondHours ?? ""}
            className="numeric h-11"
          />
        </Field>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
      <div className="border-t pt-4">
        <Button
          variant="outline"
          disabled={sending}
          onClick={() =>
            start(async () => {
              const res = await runCartRemindersAction();
              if (res.ok) toast.success(res.message ?? "Done.");
              else toast.error(res.error);
            })
          }
        >
          <Send /> {sending ? "Sending…" : "Send due reminders now"}
        </Button>
        <p className="text-muted-foreground mt-2 text-xs">
          They also go out automatically once the hourly scheduler is switched on.
        </p>
      </div>
    </div>
  );
}
