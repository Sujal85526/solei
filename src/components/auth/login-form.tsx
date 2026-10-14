"use client";

import { useFormAction } from "@/hooks/use-form-action";

import Link from "next/link";

import { fieldAria, Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, type FormState } from "@/modules/auth/actions";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useFormAction<FormState>(loginAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form {...action} className="flex flex-col gap-5" noValidate>
      {notice || state.error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {state.error ?? notice}
        </p>
      ) : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input
          {...fieldAria("email", fe.email)}
          type="email"
          autoComplete="username"
          className="h-12"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" error={fe.password}>
        <Input
          {...fieldAria("password", fe.password)}
          type="password"
          autoComplete="current-password"
          className="h-12"
          required
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Link
        href="/admin/forgot-password"
        className="text-burgundy text-center text-sm underline-offset-4 hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
