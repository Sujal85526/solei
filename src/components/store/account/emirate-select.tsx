import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ZoneOption = { emirate: string; name: string; feeLabel?: string };

/** Light-theme emirate dropdown, styled like `TextField`. */
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
  const controlled = value !== undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor="f-emirate"
        className="text-muted-foreground text-[0.6rem] tracking-[0.2em] uppercase"
      >
        Emirate
      </label>
      <div className="relative">
        <select
          id="f-emirate"
          name="emirate"
          {...(controlled ? { value } : { defaultValue })}
          onChange={(e) => onChange?.(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "f-emirate-error" : undefined}
          className="border-input focus:border-primary aria-invalid:border-destructive h-10 w-full min-w-0 appearance-none rounded-sm border bg-white ps-3 pe-9 text-sm transition-colors outline-none"
        >
          <option value="" disabled>
            Choose your emirate
          </option>
          {zones.map((z) => (
            <option key={z.emirate} value={z.emirate}>
              {z.name}
              {z.feeLabel ? ` — ${z.feeLabel}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2"
          strokeWidth={1.5}
        />
      </div>
      {error ? (
        <p id="f-emirate-error" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
