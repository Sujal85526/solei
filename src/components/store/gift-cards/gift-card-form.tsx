"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { AccountForms } from "@/components/store/account/account-forms";
import { TextField } from "@/components/store/account/text-field";
import { refreshAccount, useAccount } from "@/components/store/account/use-account";
import { SideDrawer } from "@/components/store/side-drawer";
import { giftCardsCopy as c } from "@/content/gift-cards";
import { formatAED, type Fils } from "@/lib/money";
import { cn } from "@/lib/utils";
import { buyGiftCardAction } from "@/modules/gift-cards/actions";

/**
 * Choose an amount, who it's for and a message; pay on the hosted page. Signed-out visitors sign
 * in first (the receipt lives with their orders). The card preview follows the choices.
 */
export function GiftCardForm({
  intro,
  amountsFils,
  atPos,
  expiryMonths,
}: {
  /** The page heading, shown above the form in the same column. */
  intro: ReactNode;
  amountsFils: Fils[];
  atPos: boolean;
  expiryMonths: number | null;
}) {
  const account = useAccount();
  const [amount, setAmount] = useState<Fils>(amountsFils[Math.min(1, amountsFils.length - 1)]);
  const [forOther, setForOther] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  // Idempotency key for this purchase, created on first submit (re-submits reuse it).
  const clientUuid = useRef<string | null>(null);
  const signedIn = account.status === "signed_in";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    setErrors({});
    setFormError(null);
    start(async () => {
      clientUuid.current ??= crypto.randomUUID();
      const res = await buyGiftCardAction({
        ...fd,
        clientUuid: clientUuid.current,
        amountFils: amount,
        forSomeoneElse: forOther,
      });
      if (res.ok) {
        setRedirecting(true);
        window.location.assign(res.data.redirectUrl);
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
    });
  }

  const label = "text-muted-foreground text-[0.6rem] tracking-[0.2em] uppercase";

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-20">
      <div className="lg:col-span-6">
        {intro}
        <form onSubmit={onSubmit} noValidate className="mt-12 flex flex-col gap-8">
          <fieldset className="flex flex-col gap-3">
            <legend className={cn(label, "mb-3")}>{c.amount}</legend>
            <div className="flex flex-wrap gap-2">
              {amountsFils.map((a) => (
                <label
                  key={a}
                  className={cn(
                    "numeric flex h-12 min-w-24 cursor-pointer items-center justify-center border px-5 text-sm transition-colors",
                    a === amount
                      ? "border-burgundy bg-burgundy text-pink"
                      : "border-burgundy/30 hover:border-burgundy",
                  )}
                >
                  <input
                    type="radio"
                    name="amount"
                    value={a}
                    checked={a === amount}
                    onChange={() => setAmount(a)}
                    className="sr-only"
                  />
                  {formatAED(a)}
                </label>
              ))}
            </div>
          </fieldset>

          <div role="radiogroup" aria-label="Who it's for" className="flex gap-6 text-sm">
            {(
              [
                [true, c.forSomeoneElse],
                [false, c.forMe],
              ] as const
            ).map(([value, text]) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={forOther === value}
                onClick={() => setForOther(value)}
                className={cn(
                  "border-b pb-1 transition-colors",
                  forOther === value
                    ? "border-burgundy text-burgundy"
                    : "text-foreground/60 hover:text-burgundy border-transparent",
                )}
              >
                {text}
              </button>
            ))}
          </div>

          {forOther ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={c.recipientName}
                name="recipientName"
                autoComplete="off"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                error={errors.recipientName}
              />
              <TextField
                label={c.recipientEmail}
                name="recipientEmail"
                type="email"
                autoComplete="off"
                error={errors.recipientEmail}
              />
              <TextField
                label={c.senderName}
                name="senderName"
                autoComplete="name"
                defaultValue={signedIn ? account.firstName : ""}
                error={errors.senderName}
                className="sm:col-span-2"
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gift-message" className={label}>
              {c.message}
            </label>
            <textarea
              id="gift-message"
              name="message"
              rows={3}
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={c.messagePlaceholder}
              className="border-input focus:border-primary min-h-24 w-full rounded-sm border bg-white px-3 py-2 text-sm outline-none placeholder:text-[#b9a5ab]"
            />
            {errors.message ? (
              <p className="text-destructive text-[0.7rem]">{errors.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {account.status === "signed_out" ? (
              <SignInToBuy />
            ) : (
              <button
                type="submit"
                disabled={pending || redirecting || account.status === "loading"}
                className="bg-burgundy text-pink hover:bg-burgundy/90 inline-flex h-12 items-center justify-center gap-3 px-6 text-[0.7rem] tracking-[0.22em] uppercase transition-colors disabled:opacity-60 sm:self-start"
              >
                {pending || redirecting ? c.buying : c.buy(formatAED(amount))}
                <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
              </button>
            )}
            {formError ? (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            ) : null}
            <p className="text-foreground/70 max-w-md text-xs leading-relaxed">
              {c.delivery(atPos, expiryMonths)}
            </p>
          </div>
        </form>
      </div>

      <div className="lg:col-span-5 lg:col-start-8 lg:pt-6">
        <CardPreview amount={amount} recipient={forOther ? recipient : ""} message={message} />
      </div>
    </div>
  );
}

/** The card as it will feel: burgundy, the wordmark, the amount and their name. */
function CardPreview({
  amount,
  recipient,
  message,
}: {
  amount: Fils;
  recipient: string;
  message: string;
}) {
  return (
    <figure aria-label="Gift card preview" className="mx-auto w-full max-w-md lg:sticky lg:top-28">
      <div className="bg-burgundy text-pink relative flex aspect-[1.6] w-full flex-col justify-between overflow-hidden rounded-2xl p-7 shadow-[0_30px_60px_-30px_rgba(74,14,36,0.6)] sm:p-9">
        <span
          aria-hidden
          className="border-pink/15 absolute -end-16 -top-16 size-56 rounded-full border"
        />
        <span
          aria-hidden
          className="border-pink/10 absolute -end-6 -top-6 size-36 rounded-full border"
        />
        <div className="flex items-start justify-between">
          <Logo className="h-9" title="" />
          <span className="eyebrow text-pink/70 text-[0.6rem]">{c.cardLabel}</span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="font-display text-pink/90 min-w-0 truncate text-xl italic">
            {recipient ? `For ${recipient}` : " "}
          </p>
          <p className="font-display numeric text-4xl sm:text-5xl">
            {formatAED(amount).replace(/^AED\s*/, "")}
            <span className="ms-2 font-sans text-[0.65rem] tracking-[0.2em]">AED</span>
          </p>
        </div>
      </div>
      {message ? (
        <figcaption className="font-display text-burgundy/80 mt-6 text-center text-lg italic">
          “{message}”
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Opens the same light sign-in panel as the header; the form stays as it was. */
function SignInToBuy() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-burgundy text-pink hover:bg-burgundy/90 inline-flex h-12 items-center justify-center gap-3 px-6 text-[0.7rem] tracking-[0.22em] uppercase transition-colors sm:self-start"
      >
        {c.signIn} <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.5} />
      </button>
      <SideDrawer
        open={open}
        onOpenChange={setOpen}
        side="end"
        title={c.signInTitle}
        header={<span />}
        closeLabel="Close"
        className="theme-light w-[90vw] max-w-sm overflow-y-auto px-7 sm:px-8"
      >
        <div className="mt-4 pb-4">
          <p className="text-muted-foreground mb-6 text-sm">{c.signInNote}</p>
          {open ? (
            <AccountForms
              onSignedIn={async () => {
                await refreshAccount();
                setOpen(false);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </SideDrawer>
    </>
  );
}
