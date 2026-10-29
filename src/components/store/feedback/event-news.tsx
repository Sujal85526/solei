"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventNewsCopy as c } from "@/content/feedback";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { joinEventNewsAction, setMyEventNewsAction } from "@/modules/automation/actions";

/** Sign up for event news (name optional, email required). */
export function EventNewsForm() {
  const [state, action, pending] = useFormAction(joinEventNewsAction, null);
  const e = useActionToast(state);
  if (state?.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-2xl">{c.doneTitle}</p>
        <p className="text-muted-foreground text-sm">{c.doneBody}</p>
      </div>
    );
  }
  return (
    <form {...action} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        {c.name}
        <Input name="name" autoComplete="name" maxLength={80} className="h-11" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        {c.email}
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(e.email)}
          className="h-11"
        />
        {e.email ? <span className="text-destructive text-xs">{e.email}</span> : null}
      </label>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? c.sending : c.button}
      </Button>
    </form>
  );
}

/** Account → Emails: event news on or off. */
export function EventNewsToggle({ on }: { on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <div className="border-border border-b py-5">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={optimistic}
          disabled={pending}
          onChange={(ev) => {
            const next = ev.target.checked;
            start(async () => {
              setOptimistic(next);
              await setMyEventNewsAction(next);
            });
          }}
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          {c.accountLabel}
          <span className="text-muted-foreground block text-xs">{c.accountHint}</span>
        </span>
      </label>
    </div>
  );
}
