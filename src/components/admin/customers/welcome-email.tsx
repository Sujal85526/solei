"use client";

import { Mail } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { sendWelcomeAction, sendWelcomeBatchAction } from "@/modules/customers/actions";

/** Customer page: send (or re-send) the "welcome to the website" email to this customer. */
export function SendWelcomeButton({
  id,
  name,
  email,
  alreadySent,
}: {
  id: string;
  name: string | null;
  email: string;
  alreadySent: boolean;
}) {
  return (
    <ConfirmButton
      variant={alreadySent ? "outline" : "default"}
      title={alreadySent ? "Send the welcome email again?" : "Send the welcome email?"}
      description={`${name ?? "This customer"} (${email}) gets a welcome to the website with their current sticker count${alreadySent ? " — they've had it before" : ""}. Check their stickers are up to date first.`}
      confirmLabel="Send email"
      action={() => sendWelcomeAction(id, alreadySent)}
    >
      <Mail /> {alreadySent ? "Send again" : "Send welcome email"}
    </ConfirmButton>
  );
}

/** Customers list: send the welcome to the next batch of hand-entered customers who haven't had it. */
export function SendWelcomeBatchButton({ count, batch }: { count: number; batch: number }) {
  const n = Math.min(count, batch);
  return (
    <ConfirmButton
      title={`Send ${n} welcome ${n === 1 ? "email" : "emails"}?`}
      description="Each customer gets a welcome to the website with their own sticker count. Add all their stickers first — once sent, they won't be sent this one again."
      confirmLabel={`Send ${n}`}
      action={sendWelcomeBatchAction}
    >
      <Mail /> Send welcome emails
    </ConfirmButton>
  );
}
