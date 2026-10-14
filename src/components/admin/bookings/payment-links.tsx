"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatAED } from "@/lib/money";
import { createPaymentLinkAction } from "@/modules/bookings/actions";
import { ShareButtons } from "./quote-builder";

/** Create a hosted payment link for the deposit or the full/remaining amount, then share it. */
export function PaymentLinks({
  bookingId,
  paidFils,
  depositFils,
  totalFils,
}: {
  bookingId: string;
  paidFils: number;
  depositFils: number;
  totalFils: number;
}) {
  const [link, setLink] = useState<{
    url: string;
    amountFils: number;
    whatsappUrl: string | null;
  } | null>(null);
  const [pending, start] = useTransition();
  const remaining = Math.max(0, totalFils - paidFils);

  function create(kind: "deposit" | "balance") {
    start(async () => {
      const r = await createPaymentLinkAction(bookingId, kind);
      if (r.ok) {
        setLink(r.data);
        toast.success(r.message ?? "Payment link ready.");
      } else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {paidFils === 0 && depositFils > 0 ? (
          <Button variant="outline" disabled={pending} onClick={() => create("deposit")}>
            <Link2 /> Deposit link · {formatAED(depositFils)}
          </Button>
        ) : null}
        {remaining > 0 ? (
          <Button variant="outline" disabled={pending} onClick={() => create("balance")}>
            <Link2 /> {paidFils > 0 ? "Balance" : "Full amount"} link · {formatAED(remaining)}
          </Button>
        ) : null}
      </div>
      {link ? (
        <div className="rounded-lg border p-4 text-sm" role="status">
          <p className="font-medium">Payment link · {formatAED(link.amountFils)}</p>
          <p className="text-muted-foreground mt-1 break-all" data-testid="payment-link">
            {link.url}
          </p>
          {link.whatsappUrl ? <ShareButtons link={link.url} whatsapp={link.whatsappUrl} /> : null}
        </div>
      ) : null}
    </div>
  );
}
