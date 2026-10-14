"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAED } from "@/lib/money";
import { createPaymentLinkAction, sendReminderAction } from "@/modules/orders/manual-actions";

type LinkRow = {
  id: string;
  amount_fils: number;
  url: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};
type Created = { url: string; whatsappUrl: string | null; amountFils: number };

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Create / share hosted payment links for an order's outstanding balance. */
export function PaymentLinkPanel({
  orderId,
  outstandingFils,
  links,
  canCreate,
  hasEmail,
}: {
  orderId: string;
  outstandingFils: number;
  links: LinkRow[];
  canCreate: boolean;
  hasEmail: boolean;
}) {
  const [amount, setAmount] = useState((outstandingFils / 100).toFixed(2).replace(/\.00$/, ""));
  const [created, setCreated] = useState<Created | null>(null);
  const [pending, start] = useTransition();

  const create = (reminder: boolean) =>
    start(async () => {
      const fils = Math.round(Number(amount) * 100);
      const res = reminder
        ? await sendReminderAction(orderId)
        : await createPaymentLinkAction(orderId, fils);
      if (res.ok) {
        toast.success(res.message ?? "Payment link ready.");
        setCreated(res.data);
      } else toast.error(res.error);
    });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied.");
  };

  return (
    <div className="flex flex-col gap-4">
      {canCreate && outstandingFils > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Amount (AED)" htmlFor="link-amount" className="w-36">
            <Input
              id="link-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="numeric h-11"
            />
          </Field>
          <Button onClick={() => create(false)} disabled={pending}>
            <Link2 /> Create payment link
          </Button>
          {hasEmail ? (
            <Button variant="outline" onClick={() => create(true)} disabled={pending}>
              Email reminder
            </Button>
          ) : null}
        </div>
      ) : null}

      {created ? (
        <div className="border-burgundy/30 bg-pink-wash flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Link for {formatAED(created.amountFils)}</p>
          <p className="text-muted-foreground truncate font-mono text-xs">{created.url}</p>
          <div className="flex flex-wrap gap-2">
            {created.whatsappUrl ? (
              <a
                href={created.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "sm" })}
              >
                <MessageCircle /> Share on WhatsApp
              </a>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => copy(created.url)}>
              <Copy /> Copy link
            </Button>
            <a
              href={created.url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              <ExternalLink /> Open
            </a>
          </div>
        </div>
      ) : null}

      {links.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span className="numeric font-medium">{formatAED(l.amount_fils)}</span>
              <Badge
                variant={
                  l.status === "paid" ? "success" : l.status === "active" ? "secondary" : "muted"
                }
              >
                {l.status}
              </Badge>
              <span className="numeric text-muted-foreground text-xs">
                {fmt.format(new Date(l.created_at))}
              </span>
              {l.url && l.status === "active" ? (
                <Button size="sm" variant="ghost" className="ms-auto" onClick={() => copy(l.url!)}>
                  <Copy /> Copy
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No payment links yet.</p>
      )}
    </div>
  );
}
