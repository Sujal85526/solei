"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { eventsCopy as c } from "@/content/events";
import { formatAED } from "@/lib/money";
import { acceptQuoteAction, payQuoteAction } from "@/modules/bookings/actions";

const primary =
  "bg-burgundy text-pink hover:bg-burgundy-deep inline-flex h-12 w-full items-center justify-center gap-3 px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors disabled:opacity-60";
const secondary =
  "border-burgundy/40 text-burgundy hover:border-burgundy inline-flex h-12 w-full items-center justify-center px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors disabled:opacity-60";

/** Accept → pay deposit (or in full) → pay balance, depending on where the booking is. */
export function QuoteActions({
  token,
  mode,
  depositFils,
  outstandingFils,
}: {
  token: string;
  mode: "accept" | "deposit" | "balance";
  depositFils: number;
  outstandingFils: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  function pay(kind: "deposit" | "balance") {
    setError(null);
    start(async () => {
      const r = await payQuoteAction(token, kind);
      if (r.ok) {
        setRedirecting(true);
        window.location.assign(r.data.url);
      } else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === "accept" ? (
        <>
          <button
            type="button"
            className={primary}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await acceptQuoteAction(token);
                if (r.ok) router.refresh();
                else setError(r.error);
              })
            }
          >
            {pending ? c.quote.accepting : c.quote.accept}
          </button>
          <p className="text-ink/70 text-xs">{c.quote.acceptHint}</p>
        </>
      ) : mode === "deposit" ? (
        <>
          <button
            type="button"
            className={primary}
            disabled={pending || redirecting}
            onClick={() => pay("deposit")}
          >
            <Lock className="size-3.5" strokeWidth={1.5} />
            {c.quote.payDeposit(formatAED(depositFils))}
          </button>
          {outstandingFils > depositFils ? (
            <button
              type="button"
              className={secondary}
              disabled={pending || redirecting}
              onClick={() => pay("balance")}
            >
              {c.quote.payFull(formatAED(outstandingFils))}
            </button>
          ) : null}
        </>
      ) : (
        <button
          type="button"
          className={primary}
          disabled={pending || redirecting}
          onClick={() => pay("balance")}
        >
          <Lock className="size-3.5" strokeWidth={1.5} />
          {c.quote.payBalance(formatAED(outstandingFils))}
        </button>
      )}
      {mode !== "accept" ? (
        <p className="text-ink/70 text-xs">{redirecting ? c.quote.redirecting : c.quote.secure}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[#a3172d]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
