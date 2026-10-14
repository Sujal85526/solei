"use client";

import { useRef, useState, useTransition } from "react";
import { Mail, MessageCircle, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBusinessDate } from "@/lib/dates";
import { addMessageAction } from "@/modules/bookings/actions";

type Message = {
  id: string;
  direction: "in" | "out" | "note";
  channel: "email" | "whatsapp_link" | "internal";
  body: string;
  created_at: string;
};

const CHANNEL: Record<Message["channel"], string> = {
  email: "Email",
  whatsapp_link: "WhatsApp",
  internal: "Internal",
};

/** Internal notes + messages to the customer (email, or a WhatsApp link that is logged). */
export function BookingMessages({
  bookingId,
  messages,
  canManage,
  greeting,
}: {
  bookingId: string;
  messages: Message[];
  canManage: boolean;
  greeting: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  function send(kind: "note" | "email" | "whatsapp") {
    const text = body.trim() || (kind === "whatsapp" ? greeting : "");
    if (!text) {
      toast.error("Write a message first.");
      ref.current?.focus();
      return;
    }
    // Open the tab synchronously (before awaiting) so popup blockers allow it.
    const win = kind === "whatsapp" ? window.open("", "_blank") : null;
    start(async () => {
      const fd = new FormData();
      fd.set("bookingId", bookingId);
      fd.set("kind", kind);
      fd.set("body", text);
      const r = await addMessageAction(null, fd);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setBody("");
        if (r.data.whatsappUrl) {
          if (win) win.location.href = r.data.whatsappUrl;
          else window.open(r.data.whatsappUrl, "_blank");
        }
      } else {
        win?.close();
        toast.error(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {canManage ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="booking-message">Message or note</Label>
          <Textarea
            id="booking-message"
            ref={ref}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notes stay internal. Email and WhatsApp go to the customer."
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={pending} onClick={() => send("note")}>
              <StickyNote /> Add note
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => send("email")}>
              <Mail /> Email customer
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => send("whatsapp")}>
              <MessageCircle /> Open WhatsApp
            </Button>
          </div>
        </div>
      ) : null}

      {messages.length ? (
        <ol className="flex flex-col gap-3" aria-label="Message log">
          {messages.map((m) => (
            <li
              key={m.id}
              className={
                m.direction === "note"
                  ? "rounded-lg border border-dashed p-3 text-sm"
                  : "bg-muted/50 rounded-lg p-3 text-sm"
              }
            >
              <p className="text-muted-foreground mb-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">
                  {m.direction === "note"
                    ? "Note"
                    : m.direction === "out"
                      ? "To customer"
                      : "From customer"}
                </Badge>
                {m.direction !== "note" ? CHANNEL[m.channel] : null}
                <span>
                  {formatBusinessDate(m.created_at, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </p>
              <p className="whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground text-sm">No messages yet.</p>
      )}
    </div>
  );
}
