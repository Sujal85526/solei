"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { restoreCartAction, stopRemindersAction } from "@/modules/carts/actions";
import { cart } from "@/modules/cart/store";

const c = t.cartLinks;

/** "Return to your bag": puts the saved bag back in this browser, then on to checkout. */
export function RestoreCart() {
  const params = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const id = params.get("c") ?? "";
    const token = params.get("t") ?? "";
    restoreCartAction(id, token).then((res) => {
      if (!res.ok) return setMessage(res.error);
      if (!res.data.length) return setMessage(c.alreadyBought);
      cart.clear();
      for (const l of res.data) cart.add(l.variantId, l.qty, l.options);
      router.replace("/checkout");
    });
  }, [params, router]);

  return (
    <Panel title={message ? c.restoreTitle : c.restoring}>
      {message ? (
        <>
          <p className="text-muted-foreground text-sm">{message}</p>
          <ShopLink />
        </>
      ) : null}
    </Panel>
  );
}

/** "Turn them off": a button, so email link scanners can't switch reminders off by visiting. */
export function StopReminders() {
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Panel title={done ? c.stoppedTitle : c.stopTitle}>
      <p className="text-muted-foreground text-sm">{done ? c.stoppedBody : c.stopBody}</p>
      {done ? (
        <ShopLink />
      ) : (
        <Button
          size="lg"
          disabled={pending}
          className="self-start"
          onClick={() =>
            start(async () => {
              const res = await stopRemindersAction(params.get("c") ?? "", params.get("t") ?? "");
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
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-20">
      <h1 className="text-4xl">{title}</h1>
      {children}
    </div>
  );
}

function ShopLink() {
  return (
    <Link
      href="/shop"
      className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
    >
      {t.checkout.shop}
    </Link>
  );
}
