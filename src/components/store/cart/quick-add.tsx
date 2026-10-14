"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { cart } from "@/modules/cart/store";
import { cn } from "@/lib/utils";

/** One-tap add of a product's first variant (shows a brief confirmation; the header count updates). */
export function QuickAdd({
  variantId,
  name,
  tone = "dark",
}: {
  variantId: string;
  name: string;
  tone?: "dark" | "blush";
}) {
  const [added, setAdded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        cart.add(variantId, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
      }}
      aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
      className={cn(
        "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
        tone === "blush"
          ? added
            ? "border-burgundy bg-burgundy text-pink"
            : "border-burgundy/40 text-burgundy hover:border-burgundy hover:bg-burgundy/10"
          : added
            ? "border-pink bg-pink text-burgundy"
            : "border-pink/40 text-pink hover:border-pink hover:bg-pink/10",
      )}
    >
      {added ? (
        <Check className="size-4" strokeWidth={1.5} />
      ) : (
        <Plus className="size-4" strokeWidth={1.25} />
      )}
    </button>
  );
}
