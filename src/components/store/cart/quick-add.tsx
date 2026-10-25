"use client";

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { cart } from "@/modules/cart/store";
import { cn } from "@/lib/utils";

const CONFIRM_MS = 1800;

/** One-tap add of a product's first variant: a bare plus (no circle), confirming briefly with a tick. */
export function QuickAdd({
  variantId,
  name,
  className,
}: {
  variantId: string;
  name: string;
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
        // The 40px box is the touch target; only the icon shows.
        "text-primary z-10 -me-2 flex size-10 shrink-0 items-center justify-center transition-opacity duration-300 hover:opacity-60",
        className,
      )}
    >
      {added ? (
        <Check className="size-5" strokeWidth={1.5} />
      ) : (
        <Plus className="size-5" strokeWidth={1.25} />
      )}
    </button>
  );
}
