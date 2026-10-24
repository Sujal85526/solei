import type { Metadata } from "next";
import { Suspense } from "react";
import { RestoreCart } from "@/components/store/cart/cart-links";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function RestoreCartPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <RestoreCart />
    </Suspense>
  );
}
