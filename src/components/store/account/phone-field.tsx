"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { LightSelect } from "./light-select";

/** Country codes offered first; anything else can be typed with a leading `+`. */
const CODES = [
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+965", label: "🇰🇼 +965" },
  { code: "+973", label: "🇧🇭 +973" },
  { code: "+968", label: "🇴🇲 +968" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+1", label: "🇺🇸 +1" },
];

function split(e164: string): { code: string; number: string } {
  const hit = CODES.find((c) => e164.startsWith(c.code));
  return hit
    ? { code: hit.code, number: e164.slice(hit.code.length) }
    : { code: "+971", number: e164 };
}

/**
 * Mobile number with a country-code dropdown (UAE by default). Submits one `phone` value:
 * the code plus the number (a leading 0 is dropped; a number typed with `+` is kept as is).
 */
export function PhoneField({
  label,
  name = "phone",
  defaultValue = "",
  error,
  hint,
  className,
}: {
  label: string;
  name?: string;
  /** E.164, e.g. `+971501234567`. */
  defaultValue?: string;
  error?: string;
  hint?: string;
  className?: string;
}) {
  const initial = split(defaultValue);
  const [code, setCode] = useState(initial.code);
  const [number, setNumber] = useState(initial.number);
  const digits = number.trim();
  const value = !digits
    ? ""
    : digits.startsWith("+")
      ? digits
      : `${code}${digits.replace(/^0+/, "")}`;
  const id = `f-${name}`;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="text-muted-foreground text-[0.6rem] tracking-[0.2em] uppercase"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <LightSelect
          options={CODES.map((c) => ({ value: c.code, label: c.label }))}
          value={code}
          onChange={(v) => setCode(v || "+971")}
          triggerClassName="w-[6.5rem] shrink-0"
        />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={code === "+971" ? "50 123 4567" : ""}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className="border-input focus:border-primary aria-invalid:border-destructive h-10 w-full min-w-0 rounded-sm border bg-white px-3 text-sm transition-colors outline-none placeholder:text-[#b9a5ab]"
        />
      </div>
      <input type="hidden" name={name} value={value} />
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
