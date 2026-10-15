"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LightOption = { value: string; label: string };

/**
 * Light-theme dropdown with a solid list (the native one is translucent on macOS / iOS).
 * Submits as `name` in forms; controlled when `value` is given.
 */
export function LightSelect({
  id,
  name,
  options,
  placeholder,
  value,
  defaultValue,
  onChange,
  invalid,
  describedBy,
  className,
  triggerClassName,
}: {
  id?: string;
  name?: string;
  options: LightOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const controlled = value !== undefined;
  return (
    <Select.Root
      name={name}
      items={options}
      {...(controlled ? { value: value || null } : { defaultValue: defaultValue || null })}
      onValueChange={(v) => onChange?.((v as string | null) ?? "")}
    >
      <Select.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "border-input focus-visible:border-primary aria-invalid:border-destructive data-[popup-open]:border-primary flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-sm border bg-white ps-3 pe-2.5 text-start text-sm transition-colors outline-none",
          triggerClassName,
        )}
      >
        <Select.Value
          className="truncate data-[placeholder]:text-[#b9a5ab]"
          placeholder={placeholder}
        />
        <Select.Icon className="text-muted-foreground shrink-0">
          <ChevronDown className="size-3.5" strokeWidth={1.5} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          className={cn("z-[60] outline-none", className)}
        >
          <Select.Popup className="text-ink max-h-72 min-w-(--anchor-width) overflow-y-auto rounded-sm border border-[#ead9d0] bg-white py-1 shadow-lg shadow-black/10 outline-none">
            <Select.List>
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="data-[selected]:text-burgundy flex cursor-default items-center justify-between gap-3 px-3 py-2 text-sm outline-none select-none data-[highlighted]:bg-[#f6eee8]"
                >
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="size-3.5" strokeWidth={1.75} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
