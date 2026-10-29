"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import type { ActionResult } from "@/lib/action-result";
import {
  runFeedbackRequestsAction,
  runStaffRemindersAction,
  saveAutomationSettingsAction,
  saveLabelRulesAction,
} from "@/modules/automation/actions";
import type { AutomationSettings } from "@/modules/automation/schema";
import { labelRulesToForm, type LabelRules } from "@/modules/customers/labels";

/** Owner rules for the automatic customer labels. */
export function LabelRulesForm({ rules }: { rules: LabelRules }) {
  const [state, action, pending] = useFormAction(saveLabelRulesAction, null);
  const e = useActionToast(state);
  const v = labelRulesToForm(rules);
  const num = (name: keyof typeof v, label: string, hint: string, error?: string) => (
    <Field label={label} htmlFor={name} error={error} hint={hint} required>
      <Input
        id={name}
        name={name}
        inputMode="numeric"
        defaultValue={v[name]}
        className="numeric h-11"
      />
    </Field>
  );
  return (
    <form {...action} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {num("vipSpend", "VIP: spent at least (AED)", "Paid, after refunds", e.vipSpend)}
        {num("vipMonths", "…in the last (months)", "e.g. 12 for a year", e.vipMonths)}
        {num(
          "inactiveDays",
          "Inactive: no purchase for (days)",
          "e.g. 180 for six months",
          e.inactiveDays,
        )}
        {num("newDays", "New: first purchase within (days)", "e.g. 30", e.newDays)}
        {num(
          "returningOrders",
          "Returning: at least (purchases)",
          "e.g. 2 = bought more than once",
          e.returningOrders,
        )}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function RunNow({ label, run }: { label: string; run: () => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await run();
          if (res.ok) toast.success(res.message ?? "Done.");
          else toast.error(res.error);
        })
      }
    >
      <Send /> {pending ? "Sending…" : label}
    </Button>
  );
}

function Toggle({
  name,
  defaultChecked,
  title,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  hint: string;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-primary mt-0.5 size-4"
      />
      <span>
        {title}
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  );
}

/** Feedback requests, staff reminders and the owner's digest: on/off and timing. */
export function AutomationSettingsForm({ settings }: { settings: AutomationSettings }) {
  const [state, action, pending] = useFormAction(saveAutomationSettingsAction, null);
  const e = useActionToast(state);
  return (
    <form {...action} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-medium">After delivery</legend>
        <Toggle
          name="feedbackEnabled"
          defaultChecked={settings.feedbackEnabled}
          title="Ask customers how their order was"
          hint="Once per delivered order, with a link to rate it, tell you more or write a review. Answers land in Complaints & suggestions."
        />
        <Field
          label="Days after delivery"
          htmlFor="feedbackDays"
          error={e.feedbackDays}
          className="max-w-48"
          required
        >
          <Input
            id="feedbackDays"
            name="feedbackDays"
            inputMode="numeric"
            defaultValue={settings.feedbackDays}
            className="numeric h-11"
          />
        </Field>
        <div>
          <RunNow label="Send due requests now" run={runFeedbackRequestsAction} />
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3 border-t pt-5">
        <legend className="mb-2 pt-5 font-medium">Staff</legend>
        <Toggle
          name="staffRemindersEnabled"
          defaultChecked={settings.staffRemindersEnabled}
          title="Remind staff before events and shifts"
          hint="Emails each person assigned to an event, and each planned shift on the rota."
        />
        <Field
          label="Hours before"
          htmlFor="staffReminderHours"
          error={e.staffReminderHours}
          hint="e.g. 24 for the day before"
          className="max-w-48"
          required
        >
          <Input
            id="staffReminderHours"
            name="staffReminderHours"
            inputMode="numeric"
            defaultValue={settings.staffReminderHours}
            className="numeric h-11"
          />
        </Field>
        <Toggle
          name="ownerDigestEnabled"
          defaultChecked={settings.ownerDigestEnabled}
          title="Daily summary of the coming week's events for the owner"
          hint="Who is working where, sent to the owner's alert email (Settings → Notifications)."
        />
        <div>
          <RunNow label="Send due reminders now" run={runStaffRemindersAction} />
        </div>
      </fieldset>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
      <p className="text-muted-foreground text-xs">
        These go out automatically once the scheduler is switched on. Edit the wording in Settings →
        Notifications.
      </p>
    </form>
  );
}
