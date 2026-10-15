"use client";

import { cn } from "@/lib/utils";
import { LightSelect } from "./light-select";

export type ZoneOption = { emirate: string; name: string };

/** Emirate dropdown for addresses, styled like `TextField`. */
export function EmirateSelect({
  zones,
  error,
  defaultValue,
  value,
  onChange,
  className,
}: {
  zones: ZoneOption[];
  error?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor="f-emirate"
        className="text-muted-foreground text-[0.6rem] tracking-[0.2em] uppercase"
      >
        Emirate
      </label>
      <LightSelect
        id="f-emirate"
        name="emirate"
        options={zones.map((z) => ({ value: z.emirate, label: z.name }))}
        placeholder="Choose your emirate"
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        invalid={!!error}
        describedBy={error ? "f-emirate-error" : undefined}
      />
      {error ? (
        <p id="f-emirate-error" className="text-destructive text-[0.7rem]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
