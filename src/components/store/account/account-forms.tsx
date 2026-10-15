"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { accountCopy as c } from "@/content/account";
import type { ActionResult } from "@/lib/action-result";
import {
  requestResetAction,
  resendCodeAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  verifyCodeAction,
} from "@/modules/account/actions";
import { TextField } from "./text-field";

export type AccountMode = "signIn" | "signUp";
type Step = AccountMode | "verify" | "forgot" | "reset";

const RESEND_SECONDS = 60;

/**
 * Sign in / create account / verify email / reset password, as one small state machine.
 * Used in the account drawer and as the first checkout step; `onSignedIn` runs once a session exists.
 * `initialMode` is read once — remount with a `key` to switch it from outside.
 */
export function AccountForms({
  initialMode = "signIn",
  onSignedIn,
}: {
  initialMode?: AccountMode;
  onSignedIn: () => void;
}) {
  const [step, setStep] = useState<Step>(initialMode);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function go(next: Step) {
    setErrors({});
    setFormError(null);
    setNotice(null);
    setStep(next);
  }

  function submit<T>(
    e: React.FormEvent<HTMLFormElement>,
    action: (input: Record<string, unknown>) => Promise<ActionResult<T>>,
    then: (data: T, input: Record<string, unknown>) => void,
  ) {
    e.preventDefault();
    const input: Record<string, unknown> = {
      email,
      ...Object.fromEntries(new FormData(e.currentTarget)),
    };
    setErrors({});
    setFormError(null);
    setNotice(null);
    start(async () => {
      const res = await action(input);
      if (res.ok) return then(res.data, input);
      setErrors(res.fieldErrors ?? {});
      setFormError(res.fieldErrors ? null : res.error);
    });
  }

  const codeSent = (to: string, next: Step) => {
    setEmail(to);
    setCooldown(RESEND_SECONDS);
    go(next);
  };

  const resend = (kind: "verify" | "reset") =>
    start(async () => {
      const res = await resendCodeAction({ email }, kind);
      if (res.ok) {
        setCooldown(RESEND_SECONDS);
        setNotice(c.verify.resent);
      } else setFormError(res.error);
    });

  const link =
    "text-muted-foreground hover:text-primary text-[0.7rem] tracking-[0.18em] uppercase underline-offset-4 transition-colors hover:underline";

  return (
    <div className="flex flex-col gap-7">
      {step === "signIn" ? (
        <>
          <Heading title={c.signIn.title} lede={c.signIn.lede} />
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) =>
              submit(e, signInAction, (r, input) => {
                if (r.status === "signed_in") onSignedIn();
                else codeSent(String(input.email), "verify");
              })
            }
          >
            <TextField
              label={c.signIn.email}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <TextField
              label={c.signIn.password}
              name="password"
              type="password"
              autoComplete="current-password"
              error={errors.password}
              end={
                <button type="button" onClick={() => go("forgot")} className={link}>
                  {c.signIn.forgot}
                </button>
              }
            />
            <Alert error={formError} notice={notice} />
            <Button type="submit" size="cta" disabled={pending} className="mt-1 w-full">
              {c.signIn.submit}
            </Button>
          </form>
          <button type="button" onClick={() => go("signUp")} className={link}>
            {c.signIn.switch}
          </button>
        </>
      ) : null}

      {step === "signUp" ? (
        <>
          <Heading title={c.signUp.title} lede={c.signUp.lede} />
          <form
            noValidate
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-5"
            onSubmit={(e) => submit(e, signUpAction, (r) => codeSent(r.email, "verify"))}
          >
            <TextField
              label={c.signUp.firstName}
              name="firstName"
              autoComplete="given-name"
              error={errors.firstName}
            />
            <TextField
              label={c.signUp.lastName}
              name="lastName"
              autoComplete="family-name"
              error={errors.lastName}
            />
            <TextField
              label={c.signUp.phone}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050 123 4567"
              error={errors.phone}
              className="col-span-2"
            />
            <TextField
              label={c.signUp.email}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              className="col-span-2"
            />
            <TextField
              label={c.signUp.password}
              name="password"
              type="password"
              autoComplete="new-password"
              hint={c.signUp.passwordHint}
              error={errors.password}
              className="col-span-2"
            />
            <div className="col-span-2 flex flex-col gap-5">
              <Alert error={formError} notice={notice} />
              <Button type="submit" size="cta" disabled={pending} className="mt-1 w-full">
                {c.signUp.submit}
              </Button>
            </div>
          </form>
          <button type="button" onClick={() => go("signIn")} className={link}>
            {c.signUp.switch}
          </button>
        </>
      ) : null}

      {step === "verify" ? (
        <>
          <Heading title={c.verify.title} lede={c.verify.lede(email)} />
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) => submit(e, verifyCodeAction, () => onSignedIn())}
          >
            <CodeField error={errors.code} />
            <Alert error={formError} notice={notice} />
            <Button type="submit" size="cta" disabled={pending} className="mt-1 w-full">
              {c.verify.submit}
            </Button>
          </form>
          <div className="flex flex-wrap justify-between gap-4">
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => resend("verify")}
              className={`${link} disabled:opacity-50`}
            >
              {c.verify.resend}
              {cooldown > 0 ? ` (${cooldown})` : ""}
            </button>
            <button type="button" onClick={() => go("signUp")} className={link}>
              {c.verify.back}
            </button>
          </div>
        </>
      ) : null}

      {step === "forgot" ? (
        <>
          <Heading title={c.forgot.title} lede={c.forgot.lede} />
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) =>
              submit(e, requestResetAction, (_, input) => codeSent(String(input.email), "reset"))
            }
          >
            <TextField
              label={c.signIn.email}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Alert error={formError} notice={notice} />
            <Button type="submit" size="cta" disabled={pending} className="mt-1 w-full">
              {c.forgot.submit}
            </Button>
          </form>
          <button type="button" onClick={() => go("signIn")} className={link}>
            {c.forgot.back}
          </button>
        </>
      ) : null}

      {step === "reset" ? (
        <>
          <Heading title={c.reset.title} lede={c.reset.lede(email)} />
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) => submit(e, resetPasswordAction, () => onSignedIn())}
          >
            <CodeField error={errors.code} />
            <TextField
              label={c.reset.password}
              name="password"
              type="password"
              autoComplete="new-password"
              hint={c.signUp.passwordHint}
              error={errors.password}
            />
            <Alert error={formError} notice={notice} />
            <Button type="submit" size="cta" disabled={pending} className="mt-1 w-full">
              {c.reset.submit}
            </Button>
          </form>
          <div className="flex flex-wrap justify-between gap-4">
            <button
              type="button"
              disabled={cooldown > 0 || pending}
              onClick={() => resend("reset")}
              className={`${link} disabled:opacity-50`}
            >
              {c.verify.resend}
              {cooldown > 0 ? ` (${cooldown})` : ""}
            </button>
            <button type="button" onClick={() => go("signIn")} className={link}>
              {c.forgot.back}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Heading({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-3xl italic">{title}</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">{lede}</p>
    </div>
  );
}

function CodeField({ error }: { error?: string }) {
  return (
    <TextField
      label={c.verify.code}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="••••••"
      error={error}
      className="[&_input]:text-center [&_input]:text-xl [&_input]:tracking-[0.6em]"
    />
  );
}

function Alert({ error, notice }: { error: string | null; notice: string | null }) {
  if (error)
    return (
      <p role="alert" className="bg-destructive/8 text-destructive px-4 py-3 text-sm">
        {error}
      </p>
    );
  if (notice)
    return (
      <p role="status" className="bg-muted px-4 py-3 text-sm">
        {notice}
      </p>
    );
  return null;
}
