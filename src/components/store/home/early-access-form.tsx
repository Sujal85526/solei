"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { optInAction } from "@/app/(store)/actions";
import type { OptInState } from "@/modules/marketing/service";

/** Early-access email sign-up with explicit marketing consent (blush panel styling). */
export function EarlyAccessForm() {
  const [state, action, pending] = useActionState<OptInState, FormData>(optInAction, {
    status: "idle",
  });
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <>
      {state.status === "success" ? (
        <p
          role="status"
          className="font-display text-burgundy flex items-center gap-3 text-2xl italic"
        >
          <Check className="size-5" strokeWidth={1.5} /> You&apos;re on the list.
        </p>
      ) : (
        <form action={action} noValidate>
          <input type="hidden" name="channel" value="email" />
          <label htmlFor="early-email" className="sr-only">
            Email
          </label>
          <div className="border-burgundy/40 focus-within:border-burgundy flex items-end gap-4 border-b">
            <input
              id="early-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Sign up for early access"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              className="text-burgundy placeholder:text-burgundy/60 h-12 flex-1 bg-transparent text-[0.7rem] tracking-[0.22em] uppercase outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              aria-label="Sign up"
              className="border-burgundy/50 text-burgundy hover:bg-burgundy hover:text-pink mb-1.5 flex size-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50"
            >
              <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.25} />
            </button>
          </div>
          {errors.email ? <p className="mt-2 text-sm text-[#8c1630]">{errors.email}</p> : null}
          <label className="text-ink/70 mt-5 flex cursor-pointer items-start gap-3 text-xs leading-snug">
            <input
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="accent-burgundy mt-0.5 size-4 shrink-0"
            />
            I agree to receive news and offers from Solei. Unsubscribe anytime.
          </label>
          {errors.consent ? <p className="mt-2 text-sm text-[#8c1630]">{errors.consent}</p> : null}
        </form>
      )}
    </>
  );
}
