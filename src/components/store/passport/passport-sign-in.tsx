"use client";

import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/content/en";
import { useFormAction } from "@/hooks/use-form-action";
import {
  requestPassportLinkAction,
  type PassportLinkState,
} from "@/modules/loyalty/passport-actions";

export function PassportSignIn({ linkError }: { linkError?: boolean }) {
  const [state, formProps, pending] = useFormAction<PassportLinkState>(requestPassportLinkAction, {
    status: "idle",
  });
  return (
    <div className="flex flex-col gap-5">
      {linkError && state.status === "idle" ? (
        <p role="alert" className="bg-pink/10 text-pink px-4 py-3 text-sm">
          {t.passport.linkError}
        </p>
      ) : null}
      {state.status === "sent" ? (
        <p role="status" className="border-pink/30 text-pearl border px-4 py-3 text-sm">
          {t.passport.sent}
        </p>
      ) : (
        <form
          {...formProps}
          className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
          noValidate
          aria-label={t.passport.signInTitle}
        >
          <Field
            label={t.passport.email}
            htmlFor="passport-email"
            error={state.status === "invalid" ? state.error : undefined}
          >
            <Input
              id="passport-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@example.com"
              aria-invalid={state.status === "invalid" ? true : undefined}
              className="bg-noir h-12"
            />
          </Field>
          <Button type="submit" size="cta" disabled={pending}>
            {pending ? t.passport.sending : t.passport.send}
          </Button>
        </form>
      )}
    </div>
  );
}
