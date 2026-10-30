"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { feedbackCopy as c } from "@/content/feedback";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { cn } from "@/lib/utils";
import { stopFeedbackAction, submitFeedbackAction } from "@/modules/automation/actions";

const kinds = ["compliment", "suggestion", "complaint", "other"] as const;

/** The answer to "How was your order?": stars, what kind of feedback, a message. */
export function FeedbackForm({ orderId, token }: { orderId: string; token: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [state, action, pending] = useFormAction(submitFeedbackAction, null);
  const e = useActionToast(state);
  if (state?.ok) {
    return (
      <>
        <h1 className="text-4xl">{c.thanksTitle}</h1>
        <p className="text-muted-foreground text-sm">{c.thanksBody}</p>
        <ShopLink />
      </>
    );
  }
  return (
    <form {...action} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating ?? ""} />
      <fieldset>
        <legend className="mb-3 text-sm">{c.rating}</legend>
        <div className="flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} — ${c.ratingLabels[n - 1]}`}
              onClick={() => setRating(n)}
              className={cn(
                "size-11 text-3xl leading-none transition-colors",
                rating !== null && n <= rating ? "text-gold" : "text-muted-foreground/40",
              )}
            >
              ★
            </button>
          ))}
        </div>
        {rating ? (
          <p className="text-muted-foreground mt-1 text-xs">{c.ratingLabels[rating - 1]}</p>
        ) : null}
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm">{c.kind}</legend>
        <div className="grid grid-cols-2 gap-2">
          {kinds.map((k) => (
            <label key={k} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="radio"
                name="kind"
                value={k}
                defaultChecked={k === "other"}
                className="accent-primary size-4"
              />
              {c.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-2 text-sm">
        {c.message}
        <Textarea name="message" rows={5} maxLength={2000} aria-invalid={Boolean(e.message)} />
        <span className={cn("text-xs", e.message ? "text-destructive" : "text-muted-foreground")}>
          {e.message ?? c.messageHint}
        </span>
      </label>
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? c.sending : c.send}
      </Button>
    </form>
  );
}

/** "Stop feedback emails": a button, so link scanners can't switch them off by visiting. */
export function StopFeedback({ orderId, token }: { orderId: string; token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <h1 className="text-4xl">{done ? c.stoppedTitle : c.stopTitle}</h1>
      <p className="text-muted-foreground text-sm">{done ? c.stoppedBody : c.stopBody}</p>
      {done ? (
        <ShopLink />
      ) : (
        <Button
          size="lg"
          disabled={pending || !orderId}
          className="self-start"
          onClick={() =>
            start(async () => {
              const res = await stopFeedbackAction(orderId, token);
              if (res.ok) setDone(true);
              else setError(res.error);
            })
          }
        >
          {pending ? "…" : c.stopButton}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function ShopLink() {
  return (
    <Link
      href="/shop"
      className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
    >
      {c.shop}
    </Link>
  );
}
