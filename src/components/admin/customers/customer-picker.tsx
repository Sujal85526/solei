"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { createCustomerAction, searchCustomersAction } from "@/modules/customers/actions";
import type { CustomerOption } from "@/modules/customers/queries";
import { emirateLabels, emirates, type CustomerSource } from "@/modules/customers/schema";
import { parseCustomerSearch } from "@/modules/customers/search";

export type { CustomerOption };

export type CustomerPickerProps = {
  /** Called with the chosen (or newly created / matched existing) customer. */
  onSelect: (customer: CustomerOption) => void;
  /** Show "Create new customer" (needs customers.manage — the server checks again). */
  canCreate?: boolean;
  /** `customers.source` for customers created here: "pos" at events, "whatsapp"/"direct" for manual orders. */
  source?: CustomerSource;
  /** Customers list: also ask for earlier-order stickers and offer the welcome email. */
  welcome?: boolean;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
};

const DEBOUNCE_MS = 250;

/**
 * Find a customer by phone (any local format), name or email, or create one inline.
 * Keyboard: ↑/↓ to move, Enter to choose, Esc to clear. Renders no <form>, so it can sit inside
 * other forms (manual orders, POS).
 */
export function CustomerPicker({
  onSelect,
  canCreate = true,
  source = "manual",
  welcome,
  label = "Customer",
  placeholder = "Phone, name or email",
  autoFocus,
  className,
}: CustomerPickerProps) {
  const uid = useId();
  const inputId = `${uid}-q`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [searchedFor, setSearchedFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const request = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const searchable = parseCustomerSearch(trimmed) !== null && trimmed.length >= 2;

  useEffect(() => {
    if (!searchable) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await searchCustomersAction(trimmed);
      if (id !== request.current) return; // a newer search superseded this one
      setLoading(false);
      setSearchedFor(trimmed);
      setActive(0);
      if (r.ok) {
        setResults(r.data);
        setError(null);
      } else {
        setResults([]);
        setError(r.error);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, searchable]);

  const showList = searchable && searchedFor === trimmed && !creating;
  const options = showList ? results.length + (canCreate ? 1 : 0) : 0;

  const choose = useCallback(
    (customer: CustomerOption) => {
      request.current++;
      setQuery("");
      setResults([]);
      setSearchedFor("");
      setCreating(null);
      onSelect(customer);
    },
    [onSelect],
  );

  const pick = (index: number) => {
    if (index < results.length) choose(results[index]);
    else if (canCreate) setCreating(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options) {
      e.preventDefault();
      setActive((a) => (a + 1) % options);
    } else if (e.key === "ArrowUp" && options) {
      e.preventDefault();
      setActive((a) => (a - 1 + options) % options);
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit a surrounding form
      if (options) pick(active);
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  };

  if (creating !== null) {
    return (
      <div className={className}>
        <QuickCreateCustomerForm
          initialQuery={creating}
          source={source}
          welcome={welcome}
          onCreated={choose}
          onCancel={() => {
            setCreating(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      </div>
    );
  }

  const optionId = (i: number) => `${uid}-opt-${i}`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options ? optionId(active) : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          inputMode="search"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-12 ps-9 pe-9 text-base"
        />
        {loading && searchable ? (
          <Loader2
            aria-hidden
            className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin"
          />
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {showList ? `${results.length} customers found` : ""}
      </p>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching customers"
          className="bg-card max-h-80 divide-y overflow-y-auto rounded-lg border"
        >
          {results.map((c, i) => (
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={active === i}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
              onPointerEnter={() => setActive(i)}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2",
                active === i && "bg-muted",
              )}
            >
              <span
                aria-hidden
                className="bg-pink font-display text-burgundy flex size-9 shrink-0 items-center justify-center rounded-full"
              >
                {(c.name ?? c.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.name ?? "No name"}</span>
                <span className="text-muted-foreground block truncate text-sm">
                  {[c.phone ? formatPhone(c.phone) : null, c.email].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {c.orderCount === 1 ? "1 order" : `${c.orderCount} orders`}
              </span>
            </li>
          ))}
          {results.length === 0 ? (
            <li role="presentation" className="text-muted-foreground px-3 py-3 text-sm">
              No customer matches “{trimmed}”.
            </li>
          ) : null}
          {canCreate ? (
            <li
              id={optionId(results.length)}
              role="option"
              aria-selected={active === results.length}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setCreating(trimmed)}
              onPointerEnter={() => setActive(results.length)}
              className={cn(
                "text-burgundy flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 font-medium",
                active === results.length && "bg-muted",
              )}
            >
              <UserPlus className="size-4" aria-hidden /> Create new customer
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/** Prefill from what was typed: a phone number, an email or a name. */
function prefill(query: string) {
  if (query.includes("@")) return { email: query };
  if (parseCustomerSearch(query)?.kind === "phone") return { phone: query };
  return { name: query };
}

/**
 * Inline quick-create (name, phone, email, emirate, consent). No <form> element so it can be
 * nested inside other forms; Enter in a field submits this block only.
 */
export function QuickCreateCustomerForm({
  initialQuery = "",
  source = "manual",
  welcome,
  onCreated,
  onCancel,
}: {
  initialQuery?: string;
  source?: CustomerSource;
  welcome?: boolean;
  onCreated: (customer: CustomerOption) => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const box = useRef<HTMLDivElement>(null);
  const [state, dispatch, pending] = useActionState(createCustomerAction, null);
  const errors = useActionToast(
    state,
    useCallback((d: { customer: CustomerOption }) => onCreated(d.customer), [onCreated]),
  );
  const defaults = prefill(initialQuery);

  const submit = () => {
    const fd = new FormData();
    box.current
      ?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-field]")
      .forEach((el) => {
        if (el instanceof HTMLInputElement && el.type === "checkbox") {
          if (el.checked) fd.set(el.dataset.field!, "on");
        } else fd.set(el.dataset.field!, el.value);
      });
    fd.set("source", source);
    startTransition(() => dispatch(fd));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
      submit();
    }
  };
  const id = (f: string) => `${uid}-${f}`;
  const aria = (f: string) => ({
    id: id(f),
    "data-field": f,
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": errors[f] ? `${id(f)}-error` : undefined,
  });

  return (
    <div
      ref={box}
      role="group"
      aria-labelledby={id("title")}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4"
    >
      <p id={id("title")} className="font-medium">
        New customer
      </p>
      <p className="text-muted-foreground -mt-3 text-sm">
        Enter a name and at least a phone or an email.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor={id("name")}
          error={errors.name}
          required
          className="sm:col-span-2"
        >
          <Input
            {...aria("name")}
            defaultValue={defaults.name}
            autoFocus={!defaults.name}
            autoComplete="off"
            className="h-12 text-base"
          />
        </Field>
        <Field
          label="Phone"
          htmlFor={id("phone")}
          error={errors.phone}
          hint="Any format, e.g. 050 123 4567"
        >
          <Input
            {...aria("phone")}
            type="tel"
            defaultValue={defaults.phone}
            autoComplete="off"
            className="h-12 text-base"
          />
        </Field>
        <Field
          label="Email"
          htmlFor={id("email")}
          error={errors.email}
          hint="Optional. Without an email, sales are still saved and stickers still count, but they won't show in an online account, and this customer gets no emails or payment links. You can add it later."
        >
          <Input
            {...aria("email")}
            type="email"
            defaultValue={defaults.email}
            autoComplete="off"
            className="h-12 text-base"
          />
        </Field>
        <Field label="Emirate" htmlFor={id("emirate")} error={errors.emirate}>
          <NativeSelect {...aria("emirate")} defaultValue="" className="[&_select]:h-12">
            <option value="">Not given</option>
            {emirates.map((e) => (
              <option key={e} value={e}>
                {emirateLabels[e]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex min-h-12 items-center gap-3 text-sm sm:self-end">
          <input type="checkbox" data-field="marketingConsent" className="accent-burgundy size-5" />
          Agrees to marketing messages
        </label>
        {welcome ? (
          <>
            <Field
              label="Stickers already collected"
              htmlFor={id("pastStamps")}
              error={errors.pastStamps}
              hint="From their earlier orders — leave 0 if none."
            >
              <Input
                {...aria("pastStamps")}
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                defaultValue={0}
                className="h-12 text-base"
              />
            </Field>
            <label className="flex min-h-12 items-center gap-3 text-sm sm:self-end">
              <input
                type="checkbox"
                data-field="sendWelcome"
                defaultChecked
                className="accent-burgundy size-5"
              />
              Email them a welcome to the website now (only if you entered an email)
            </label>
          </>
        ) : null}
      </div>
      {state && !state.ok && !Object.keys(errors).length ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save customer"}
        </Button>
        {onCancel ? (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel} disabled={pending}>
            Back to search
          </Button>
        ) : null}
      </div>
    </div>
  );
}
