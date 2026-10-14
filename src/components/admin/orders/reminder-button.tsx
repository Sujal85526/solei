"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { sendReminderAction } from "@/modules/orders/manual-actions";

/** Creates a fresh payment link (+ email if we have one), then offers the WhatsApp message. */
export function ReminderButton({ orderId }: { orderId: string }) {
  const [wa, setWa] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (wa) {
    return (
      <a href={wa} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
        <MessageCircle /> Send on WhatsApp
      </a>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await sendReminderAction(orderId);
          if (res.ok) {
            toast.success(res.message ?? "Reminder ready.");
            if (res.data.whatsappUrl) setWa(res.data.whatsappUrl);
          } else toast.error(res.error);
        })
      }
    >
      <Send /> {pending ? "Preparing…" : "Send reminder"}
    </Button>
  );
}
