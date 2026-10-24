"use client";

import { useOptimistic, useTransition } from "react";
import { accountCopy as c } from "@/content/account";
import { setMyCartRemindersAction } from "@/modules/carts/actions";

/** Account → Emails: switch bag reminders on or off. */
export function CartRemindersToggle({ on }: { on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <div className="border-border border-b py-5">
      <h2 className="text-muted-foreground font-sans text-[0.6rem] tracking-[0.25em] uppercase">
        {c.page.emails}
      </h2>
      <label className="mt-3 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={optimistic}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              setOptimistic(next);
              await setMyCartRemindersAction(next);
            });
          }}
          className="accent-primary mt-0.5 size-4"
        />
        <span>
          {c.page.cartReminders}
          <span className="text-muted-foreground block text-xs">{c.page.cartRemindersHint}</span>
        </span>
      </label>
    </div>
  );
}
