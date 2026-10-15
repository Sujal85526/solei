"use client";

import { Minus, Plus } from "lucide-react";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";

/** − qty + stepper with large tap targets. `max` caps at available stock; colours follow the theme. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "lg",
  shape = "pill",
  label = t.product.quantity,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "md" | "lg";
  shape?: "pill" | "square";
  label?: string;
  className?: string;
}) {
  const btn = cn(
    "text-primary hover:bg-primary/5 inline-flex items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-30",
    size === "lg" ? "size-12" : "size-11",
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "border-primary/25 inline-flex items-center border",
        shape === "pill" ? "rounded-full" : "rounded-none",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        className={cn(btn, shape === "pill" && "rounded-s-full")}
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
          "numeric text-primary text-center font-medium",
          size === "lg" ? "w-10 text-base" : "w-8 text-sm",
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={cn(btn, shape === "pill" && "rounded-e-full")}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={t.product.increase}
      >
        <Plus className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
