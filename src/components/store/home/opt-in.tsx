"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { optInAction } from "@/app/(store)/actions";
import { Container, Eyebrow, PostmarkWaves, WhatsAppIcon } from "@/components/brand";
import { Stagger } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OptInState } from "@/modules/marketing/service";

const inputClass =
  "h-12 w-full rounded-md border border-input bg-cream px-3 text-base outline-none placeholder:text-ink-muted/70 focus-visible:border-burgundy focus-visible:ring-3 focus-visible:ring-burgundy/20 aria-invalid:border-destructive";

/** Native form + server action: works without JS and keeps the homepage bundle small. */
export function OptIn() {
  const [state, action, pending] = useActionState<OptInState, FormData>(optInAction, {
    status: "idle",
  });
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const errors = state.status === "error" ? state.fieldErrors : {};
  // Controlled so values survive React's automatic form reset after the action.
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  return (
    <section aria-labelledby="optin-title" className="bg-sand py-20 sm:py-24">
      <Container size="narrow" className="flex flex-col items-center gap-6 text-center">
        <Stagger className="flex flex-col items-center gap-6">
          <PostmarkWaves className="w-28" lines={3} />
          <Eyebrow>Postcards from Solei</Eyebrow>
          <h2 id="optin-title" className="text-3xl sm:text-4xl">
            New destinations, pop-ups <span className="italic">& private previews.</span>
          </h2>
        </Stagger>
        {state.status === "success" ? (
          <p role="status" className="font-display text-burgundy text-xl italic">
            Thank you — your first postcard is on its way.
          </p>
        ) : (
          <form
            action={action}
            noValidate
            className="flex w-full max-w-lg flex-col gap-4 text-start"
          >
            <fieldset className="flex justify-center gap-2">
              <legend className="sr-only">How should we reach you?</legend>
              {(["email", "whatsapp"] as const).map((c) => (
                <label
                  key={c}
                  className={cn(
                    "has-focus-visible:ring-burgundy inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-5 text-sm transition-colors has-focus-visible:ring-2",
                    channel === c
                      ? "border-burgundy bg-burgundy text-cream"
                      : "border-burgundy/30 text-burgundy",
                  )}
                >
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                    className="sr-only"
                  />
                  {c === "email" ? (
                    <Mail className="size-4" strokeWidth={1.5} />
                  ) : (
                    <WhatsAppIcon className="size-4" />
                  )}
                  {c === "email" ? "Email" : "WhatsApp"}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                {channel === "email" ? (
                  <Field id="optin-email" label="Email" error={errors.email}>
                    <input
                      id="optin-email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={inputClass}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? "optin-email-error" : undefined}
                    />
                  </Field>
                ) : (
                  <Field id="optin-phone" label="WhatsApp number" error={errors.phone}>
                    <input
                      id="optin-phone"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="050 123 4567"
                      className={inputClass}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? "optin-phone-error" : undefined}
                    />
                  </Field>
                )}
              </div>
              <Button type="submit" size="cta" disabled={pending}>
                {pending ? "Sending…" : "Subscribe"}
              </Button>
            </div>
            <div>
              <label
                htmlFor="optin-consent"
                className="text-ink-muted flex cursor-pointer items-start gap-3 text-sm leading-snug"
              >
                <input
                  id="optin-consent"
                  name="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  type="checkbox"
                  className="accent-burgundy mt-0.5 size-5 shrink-0"
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? "optin-consent-error" : undefined}
                />
                I agree to receive news and offers from Solei. Unsubscribe anytime.
              </label>
              {errors.consent ? (
                <p id="optin-consent-error" className="text-destructive mt-1.5 text-sm">
                  {errors.consent}
                </p>
              ) : null}
            </div>
            {state.status === "error" && state.message ? (
              <p role="alert" className="text-destructive text-center text-sm">
                {state.message}
              </p>
            ) : null}
          </form>
        )}
      </Container>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive mt-1.5 text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
