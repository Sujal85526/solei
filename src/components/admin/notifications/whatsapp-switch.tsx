"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { setWhatsAppUpdatesAction } from "@/modules/notifications/actions";

/** Owner switch for WhatsApp order updates (transactional, to the order's mobile). */
export function WhatsAppSwitch({ on, provider }: { on: boolean; provider: string }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={optimistic}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setOptimistic(next);
            const r = await setWhatsAppUpdatesAction(next);
            if (r.ok) toast.success(r.message ?? "Saved.");
            else toast.error(r.error);
          });
        }}
        className="accent-primary mt-0.5 size-4"
      />
      <span>
        <span className="font-medium">Send WhatsApp order updates</span>
        <span className="text-muted-foreground block text-xs">
          “Order confirmed” and “On its way” to the customer&apos;s mobile, alongside the emails.
          {provider === "log"
            ? " WhatsApp Business isn't connected yet — messages are only written to the outbox."
            : ""}
        </span>
      </span>
    </label>
  );
}
