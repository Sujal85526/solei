"use client";

import { useFormAction } from "@/hooks/use-form-action";

import Link from "next/link";

import { fieldAria, Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { forgotPasswordAction, setPasswordAction, type FormState } from "@/modules/auth/actions";

export function ForgotPasswordForm() {
  const [state, action, pending] = useFormAction<FormState>(forgotPasswordAction, {});
  if (state.message) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="bg-pink-wash text-burgundy rounded-md px-4 py-3 text-sm">
          {state.message}
        </p>
        <Link
          href="/admin/login"
          className="text-burgundy text-center text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }
  const err = state.fieldErrors?.email;
  return (
    <form {...action} className="flex flex-col gap-5" noValidate>
      <Field label="Email" htmlFor="email" error={err}>
        <Input {...fieldAria("email", err)} type="email" autoComplete="username" className="h-12" />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link
        href="/admin/login"
        className="text-burgundy text-center text-sm underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action, pending] = useFormAction<FormState>(setPasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form {...action} className="flex flex-col gap-5" noValidate>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
      <Field
        label="New password"
        htmlFor="password"
        error={fe.password}
        hint="At least 10 characters, with letters and numbers."
      >
        <PasswordInput
          {...fieldAria("password", fe.password)}
          autoComplete="new-password"
          className="h-12"
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={fe.confirm}>
        <PasswordInput
          {...fieldAria("confirm", fe.confirm)}
          autoComplete="new-password"
          className="h-12"
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
