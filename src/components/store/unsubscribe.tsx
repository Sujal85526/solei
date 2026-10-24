"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/content/en";
import { unsubscribeAction } from "@/modules/campaigns/actions";

const c = t.unsubscribe;

/** Campaign unsubscribe: one button (so link scanners in inboxes can't unsubscribe anyone). */
export function Unsubscribe() {
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = params.get("c") ?? "";
  const token = params.get("t") ?? "";
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-20">
      <h1 className="text-4xl">{done ? c.doneTitle : c.title}</h1>
      <p className="text-muted-foreground text-sm">{done ? c.doneBody : c.body}</p>
      {done ? (
        <Link
          href="/shop"
          className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
        >
          {t.checkout.shop}
        </Link>
      ) : (
        <Button
          size="lg"
          className="self-start"
          disabled={pending || !id}
          onClick={() =>
            start(async () => {
              const res = await unsubscribeAction(id, token);
              if (res.ok) setDone(true);
              else setError(res.error);
            })
          }
        >
          {pending ? "…" : c.button}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
