"use client";

import { Minus, Plus } from "lucide-react";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";

/** − qty + stepper with large tap targets. `max` caps at available stock. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "lg",
  label = t.product.quantity,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "md" | "lg";
  label?: string;
  className?: string;
}) {
  const btn = cn(
    "text-burgundy hover:bg-burgundy/5 inline-flex items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-30",
    size === "lg" ? "size-12" : "size-11",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-burgundy/25 inline-flex items-center rounded-full border",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        className={cn(btn, "rounded-s-full")}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={t.product.decrease}
      >
        <Minus className="size-4" strokeWidth={1.5} />
      </button>
      <output
        aria-live="polite"
        aria-label={label}
        className={cn(
          "numeric text-burgundy text-center font-medium",
          size === "lg" ? "w-10 text-base" : "w-8 text-sm",
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={cn(btn, "rounded-e-full")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={t.product.increase}
      >
        <Plus className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
