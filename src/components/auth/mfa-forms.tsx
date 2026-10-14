"use client";

import { useFormAction } from "@/hooks/use-form-action";

import { useEffect, useState } from "react";
import { fieldAria, Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startTotpEnrollment, verifyTotpAction, type FormState } from "@/modules/auth/actions";

function CodeForm({ factorId, cta }: { factorId: string; cta: string }) {
  const [state, action, pending] = useFormAction<FormState>(verifyTotpAction, {});
  const err = state.fieldErrors?.code ?? state.error;
  return (
    <form {...action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="factorId" value={factorId} />
      <Field label="6-digit code" htmlFor="code" error={err}>
        <Input
          {...fieldAria("code", err)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          className="numeric h-14 text-center text-2xl tracking-[0.5em]"
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Checking…" : cta}
      </Button>
    </form>
  );
}

export function VerifyTotp({ factorId }: { factorId: string }) {
  return <CodeForm factorId={factorId} cta="Verify" />;
}

export function EnrollTotp() {
  const [enrollment, setEnrollment] = useState<
    { factorId: string; qrCode: string; secret: string } | { error: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    startTotpEnrollment().then((res) => {
      if (!cancelled) setEnrollment(res.ok ? res : { error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enrollment) return <p className="text-ink-muted text-sm">Preparing your QR code…</p>;
  if ("error" in enrollment)
    return (
      <p role="alert" className="text-destructive text-sm">
        {enrollment.error}
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <ol className="text-ink-muted list-decimal space-y-1 ps-5 text-sm">
        <li>Open Google Authenticator, 1Password or a similar app.</li>
        <li>Scan the QR code, or enter the key manually.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      <div className="flex justify-center rounded-md border bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data-URI SVG from Supabase */}
        <img
          src={enrollment.qrCode}
          alt="QR code for your authenticator app"
          width={180}
          height={180}
        />
      </div>
      <p className="text-ink-muted text-center text-xs">
        Key:{" "}
        <code
          data-testid="totp-secret"
          className="numeric bg-sand text-ink rounded px-1.5 py-0.5 break-all"
        >
          {enrollment.secret}
        </code>
      </p>
      <CodeForm factorId={enrollment.factorId} cta="Turn on two-factor" />
    </div>
  );
}
