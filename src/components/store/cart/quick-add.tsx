"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cart } from "@/modules/cart/store";
import { cn } from "@/lib/utils";

const CONFIRM_MS = 1800;

/** One-tap add of a product's first variant; confirms briefly with a tick. */
export function QuickAdd({
  variantId,
  name,
  tone = "overlay",
  className,
}: {
  variantId: string;
  name: string;
  /** `overlay`: filled, for use over a photo; `outline`: a hairline circle in the text colour. */
  tone?: "overlay" | "outline";
  className?: string;
}) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [added]);

  return (
    <button
      type="button"
      onClick={() => {
        cart.add(variantId, 1);
        setAdded(true);
      }}
      aria-label={added ? `${name} added to cart` : `Add ${name} to cart`}
      className={cn(
        "z-10 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
        tone === "outline"
          ? added
            ? "border-primary bg-primary text-primary-foreground border"
            : "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground border"
          : added
            ? "bg-burgundy text-pink"
            : "bg-pearl/80 text-burgundy hover:bg-burgundy hover:text-pink",
        className,
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
