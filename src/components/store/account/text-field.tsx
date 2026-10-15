"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { EyeToggle } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

/**
 * Light-theme form field: small letter-spaced label, hairline input, error or hint below.
 * Password fields get a show/hide eye toggle.
 */
export function TextField({
  label,
  name,
  error,
  hint,
  className,
  end,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  /** Something inside the input's end (e.g. a link). */
  end?: ReactNode;
}) {
  const id = props.id ?? `f-${name}`;
  const isPassword = props.type === "password";
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-muted-foreground text-[0.6rem] tracking-[0.2em] uppercase"
        >
          {label}
        </label>
        {end}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            "border-input focus:border-primary aria-invalid:border-destructive h-10 w-full min-w-0 rounded-sm border bg-white px-3 text-sm transition-colors outline-none placeholder:text-[#b9a5ab]",
            isPassword && "pe-11",
          )}
          {...props}
          type={isPassword && visible ? "text" : props.type}
        />
        {isPassword ? (
          <EyeToggle
            visible={visible}
            onToggle={() => setVisible((v) => !v)}
            className="text-ink-muted hover:text-burgundy"
          />
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-[0.7rem]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-[0.7rem]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
