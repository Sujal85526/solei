import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FeedbackForm, ShopLink } from "@/components/store/feedback/feedback-form";
import { feedbackCopy as c } from "@/content/feedback";
import { feedbackRequestFromLink } from "@/modules/automation/service";

export const metadata: Metadata = { title: "Your feedback", robots: { index: false } };

/** From the "How was your order?" email: rate the order and tell us more (signed link). */
export default function FeedbackPage(props: PageProps<"/feedback">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <FeedbackView {...props} />
    </Suspense>
  );
}

async function FeedbackView({ searchParams }: PageProps<"/feedback">) {
  await connection();
  const sp = await searchParams;
  const orderId = typeof sp.o === "string" ? sp.o : "";
  const token = typeof sp.t === "string" ? sp.t : "";
  const request = /^[0-9a-f-]{36}$/.test(orderId)
    ? await feedbackRequestFromLink(orderId, token)
    : null;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-20">
      {!request ? (
        <>
          <h1 className="text-4xl">{c.invalidTitle}</h1>
          <p className="text-muted-foreground text-sm">{c.invalidBody}</p>
          <Link
            href="/contact"
            className="text-primary text-[0.7rem] tracking-[0.2em] uppercase underline underline-offset-4"
          >
            {c.contact}
          </Link>
        </>
      ) : request.answered ? (
        <>
          <h1 className="text-4xl">{c.answeredTitle}</h1>
          <ShopLink />
        </>
      ) : (
        <>
          <h1 className="text-4xl">{c.title(request.orderNumber)}</h1>
          <p className="text-muted-foreground text-sm">{c.lede}</p>
          <FeedbackForm orderId={orderId} token={token} />
        </>
      )}
    </div>
  );
}
