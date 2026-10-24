import type { Metadata } from "next";
import { Suspense } from "react";
import { StopReminders } from "@/components/store/cart/cart-links";

export const metadata: Metadata = { title: "Bag reminders", robots: { index: false } };

export default function StopRemindersPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <StopReminders />
    </Suspense>
  );
}
