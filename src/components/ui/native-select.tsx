"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
} from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";
import { SelectContent, SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { optionsFromChildren } from "./native-select-options";

/** Base UI can't hold "" as an item's value; "Any" / "Not given" options use this instead. */
const EMPTY = "__empty__";
const toKey = (value: string) => value || EMPTY;
const fromKey = (key: string) => (key === EMPTY ? "" : key);

/**
 * A select with our own solid list: browsers draw a native select's list themselves (translucent on
 * macOS) and it can't be styled. Takes the same props and `<option>` children as `<select>`, and a
 * real, visually hidden `<select>` stays underneath, so forms, labels and `onChange` work as before.
 * Style the visible box through its button, e.g. `[&_button]:h-12`.
 */
export function NativeSelect({
  className,
  children,
  ref,
  value,
  defaultValue,
  onChange,
  onFocus,
  ...props
}: ComponentProps<"select">) {
  const options = optionsFromChildren(children);
  const first = options.find((o) => !o.disabled)?.value ?? "";
  const initial = defaultValue === undefined ? first : String(defaultValue);
  const [own, setOwn] = useState(initial);
  const current = value === undefined ? own : String(value);
  const ariaLabel = props["aria-label"];
  const [label, setLabel] = useState(ariaLabel);
  const select = useRef<HTMLSelectElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const attach = useCallback(
    (el: HTMLSelectElement | null) => {
      select.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useEffect(() => {
    const el = select.current;
    if (!el) return;
    // The visible box is named by the same <label> as the hidden select.
    setLabel(ariaLabel ?? el.labels?.[0]?.textContent?.replace(/\s*\*\s*$/, "") ?? undefined);
    const form = el.form;
    if (!form) return;
    const reset = () => setOwn(initial);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [ariaLabel, initial]);

  /** A pick from the list goes through the real select, so `onChange` gets a normal change event. */
  const pick = (key: string | null) => {
    const el = select.current;
    if (!el || key === null) return;
    const next = fromKey(key);
    if (next === current) return;
    el.value = next;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const groups = [...new Set(options.map((o) => o.group))];
  const item = (o: (typeof options)[number]) => (
    <SelectItem
      key={o.value}
      value={toKey(o.value)}
      disabled={o.disabled}
      className="min-h-10 text-sm"
    >
      {o.label}
    </SelectItem>
  );

  return (
    <div className={cn("relative", className)}>
      <select
        {...props}
        ref={attach}
        value={current}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          setOwn(e.target.value);
          onChange?.(e);
        }}
        onFocus={(e) => {
          onFocus?.(e);
          trigger.current?.focus(); // a click on the <label> lands here
        }}
        data-slot="native-select"
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      >
        {children}
      </select>
      <SelectPrimitive.Root
        items={options.map((o) => ({ value: toKey(o.value), label: o.label }))}
        value={toKey(current)}
        onValueChange={pick}
        disabled={props.disabled}
      >
        <SelectPrimitive.Trigger
          ref={trigger}
          title={label}
          aria-invalid={props["aria-invalid"]}
          aria-describedby={props["aria-describedby"]}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/20 aria-invalid:border-destructive flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border ps-3 pe-3 text-start text-sm outline-none focus-visible:ring-3 disabled:opacity-50"
        >
          <SelectPrimitive.Value className="truncate" />
          <SelectPrimitive.Icon
            render={<ChevronDown className="text-muted-foreground size-4 shrink-0" />}
          />
        </SelectPrimitive.Trigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {groups.map((group) =>
            group ? (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {options.filter((o) => o.group === group).map(item)}
              </SelectGroup>
            ) : (
              options.filter((o) => !o.group).map(item)
            ),
          )}
        </SelectContent>
      </SelectPrimitive.Root>
    </div>
  );
}
