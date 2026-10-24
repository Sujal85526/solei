import type { Metadata } from "next";
import { Suspense } from "react";
import { Unsubscribe } from "@/components/store/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Unsubscribe />
    </Suspense>
  );
}
