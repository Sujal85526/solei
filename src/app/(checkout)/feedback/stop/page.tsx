import type { Metadata } from "next";
import { Suspense } from "react";
import { StopFeedback } from "@/components/store/feedback/feedback-form";

export const metadata: Metadata = { title: "Feedback emails", robots: { index: false } };

export default function StopFeedbackPage(props: PageProps<"/feedback/stop">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <StopView {...props} />
    </Suspense>
  );
}

async function StopView({ searchParams }: PageProps<"/feedback/stop">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-20">
      <StopFeedback
        orderId={typeof sp.o === "string" ? sp.o : ""}
        token={typeof sp.t === "string" ? sp.t : ""}
      />
    </div>
  );
}
