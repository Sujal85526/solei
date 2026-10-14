"use client";

import { Check } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/content/en";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { trackOrderAction, type TrackResult } from "@/modules/checkout/track";

const STEPS = ["new", "preparing", "dispatched", "delivered"] as const;
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function TrackForm({ defaultNumber }: { defaultNumber?: string }) {
  const [state, formProps, pending] = useFormAction<TrackResult>(trackOrderAction, {
    status: "idle",
  });
  return (
    <div className="flex flex-col gap-10">
      <form {...formProps} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={t.track.number} htmlFor="number">
          <Input
            id="number"
            name="number"
            defaultValue={defaultNumber}
            placeholder="SOL-001234"
            className="bg-cream h-12 uppercase"
          />
        </Field>
        <Field label={t.track.phone} htmlFor="phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="050 123 4567"
            className="bg-cream h-12"
          />
        </Field>
        <Button type="submit" size="cta" disabled={pending}>
          {t.track.submit}
        </Button>
      </form>
      {state.status === "not_found" ? (
        <p role="alert" className="bg-pink-wash text-burgundy px-4 py-3 text-sm">
          {t.track.notFound}
        </p>
      ) : null}
      {state.status === "found" ? <Timeline order={state.order} /> : null}
    </div>
  );
}

function Timeline({ order }: { order: Extract<TrackResult, { status: "found" }>["order"] }) {
  const reached = (step: string) => order.history.find((h) => h.status === step);
  const currentIndex = Math.max(
    ...STEPS.map((s, i) => (reached(s) || order.status === s ? i : -1)),
  );
  return (
    <section aria-label={`Order ${order.number}`} className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-3xl">{order.number}</h2>
        <p className="numeric text-ink-muted text-sm">
          {formatAED(order.totalFils)} ·{" "}
          {order.paymentStatus === "paid" ? "Paid" : "Awaiting payment"}
        </p>
      </div>
      {order.status === "cancelled" ? (
        <p className="text-burgundy">This order was cancelled.</p>
      ) : (
        <ol className="grid gap-6 sm:grid-cols-4">
          {STEPS.map((step, i) => {
            const at = reached(step)?.at;
            const done = i <= currentIndex;
            return (
              <li key={step} className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border",
                    done
                      ? "border-burgundy bg-burgundy text-pink"
                      : "border-burgundy/25 text-burgundy/40",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span>
                  <span
                    className={cn(
                      "font-display block text-lg",
                      done ? "text-burgundy" : "text-ink-muted",
                    )}
                  >
                    {t.track.steps[step]}
                  </span>
                  {at ? (
                    <span className="numeric text-ink-muted text-xs">
                      {dateFmt.format(new Date(at))}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {order.trackingNumber ? (
        <p className="text-sm">
          Tracking: <span className="font-mono">{order.trackingNumber}</span>
          {order.courier ? ` (${order.courier})` : ""}
        </p>
      ) : null}
      <ul className="border-burgundy/15 text-ink-muted flex flex-col gap-1 border-t pt-4 text-sm">
        {order.lines.map((l, i) => (
          <li key={i}>
            {l.name}
            {l.variant ? ` · ${l.variant}` : ""} × {l.qty}
          </li>
        ))}
      </ul>
    </section>
  );
}
