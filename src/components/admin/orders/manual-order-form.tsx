"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Minus, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { CustomerPicker, type CustomerOption } from "@/components/admin/customers/customer-picker";
import { Field } from "@/components/admin/field";
import { AdminSection } from "@/components/admin/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { aedToFils, formatAED } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { createManualOrderAction } from "@/modules/orders/manual-actions";
import type { SellableVariant } from "@/modules/orders/manual-queries";
import { priceCart } from "@/modules/orders/pricing";
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/modules/orders/status";

type Zone = { emirate: string; name: string; fee_fils: number };
type Line = { variantId: string; qty: number; price: string; reason: string };

const toAed = (fils: number) => (fils / 100).toFixed(2).replace(/\.00$/, "");

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted grid grid-flow-col gap-1 rounded-lg p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-md px-3 text-sm transition-colors",
            value === o.value
              ? "bg-card text-burgundy font-medium shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ManualOrderForm({
  variants,
  zones,
  vatRateBp,
  pricesIncludeVat,
  canOverride,
  canRecordPayment,
}: {
  variants: SellableVariant[];
  zones: Zone[];
  vatRateBp: number;
  pricesIncludeVat: boolean;
  canOverride: boolean;
  canRecordPayment: boolean;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const [channel, setChannel] = useState<"whatsapp" | "direct">("whatsapp");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [picker, setPicker] = useState("");
  const [fulfilment, setFulfilment] = useState<"handed_over" | "pickup" | "delivery">(
    "handed_over",
  );
  const [address, setAddress] = useState({ line1: "", line2: "", area: "", city: "" });
  const [emirate, setEmirate] = useState("");
  const [fee, setFee] = useState("0");
  const [notes, setNotes] = useState("");
  const [payMode, setPayMode] = useState<"later" | "full" | "partial">("later");
  const [method, setMethod] = useState<(typeof MANUAL_PAYMENT_METHODS)[number]>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const clientUuid = useRef<string | null>(null);

  const addVariant = (id: string) => {
    if (!id) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === id);
      if (existing) return prev.map((l) => (l.variantId === id ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...prev,
        { variantId: id, qty: 1, price: toAed(byId.get(id)!.priceFils), reason: "" },
      ];
    });
    setPicker("");
  };
  const update = (id: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.variantId === id ? { ...l, ...patch } : l)));

  const pricedLines = lines.map((l) => {
    const v = byId.get(l.variantId)!;
    let unit = v.priceFils;
    try {
      unit = l.price.trim() === "" ? v.priceFils : aedToFils(l.price);
    } catch {
      unit = v.priceFils;
    }
    return { ...l, variant: v, unitFils: Math.max(0, unit), changed: unit !== v.priceFils };
  });
  const feeFils = fulfilment === "delivery" ? Math.max(0, Math.round(Number(fee || 0) * 100)) : 0;
  const pricing = priceCart({
    lines: pricedLines.map((l) => ({ unitPriceFils: l.unitFils, qty: l.qty })),
    vatRateBp,
    pricesIncludeVat,
    deliveryFeeFils: fulfilment === "delivery" ? feeFils : 0,
    freeDeliveryThresholdFils: null,
    fulfilment: fulfilment === "delivery" ? "delivery" : "pickup",
  });

  function submit() {
    const errs: Record<string, string> = {};
    if (!customer) errs.customer = "Choose or create the customer";
    if (!pricedLines.length) errs.lines = "Add at least one product";
    pricedLines.forEach((l) => {
      if (l.changed && l.reason.trim().length < 3)
        errs[`reason-${l.variantId}`] = "Say why the price changed";
    });
    if (fulfilment === "delivery") {
      if (!address.line1 || !address.area) errs.address = "Enter the delivery address";
      if (!emirate) errs.emirate = "Choose the emirate";
    }
    if (payMode === "partial" && !(Number(amount) > 0)) errs.amount = "Enter the amount received";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    clientUuid.current ??= crypto.randomUUID();
    start(async () => {
      const res = await createManualOrderAction({
        clientUuid: clientUuid.current,
        channel,
        customerId: customer!.id,
        fulfilment,
        deliveryAddress: fulfilment === "delivery" ? address : undefined,
        deliveryEmirate: fulfilment === "delivery" ? emirate : undefined,
        deliveryFeeFils: feeFils,
        notes,
        lines: pricedLines.map((l) => ({
          variantId: l.variantId,
          qty: l.qty,
          unitPriceFils: l.unitFils,
          listPriceFils: l.variant.priceFils,
          overrideReason: l.reason,
        })),
        payment: {
          mode: canRecordPayment ? payMode : "later",
          method,
          amountFils: payMode === "partial" ? Math.round(Number(amount) * 100) : 0,
          reference,
        },
      });
      if (res.ok) {
        toast.success(res.message);
        router.push(`/admin/orders/${res.data.orderId}`);
      } else {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <AdminSection title="Customer">
          <div className="flex flex-col gap-4">
            <Segmented
              label="Channel"
              value={channel}
              onChange={setChannel}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "direct", label: "Direct" },
              ]}
            />
            {customer ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <span className="bg-pink text-burgundy flex size-10 items-center justify-center rounded-full">
                  <UserRound className="size-5" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{customer.name ?? "Unnamed customer"}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {[customer.phone ? formatPhone(customer.phone) : null, customer.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCustomer(null)}
                  aria-label="Change customer"
                >
                  <X />
                </Button>
              </div>
            ) : (
              <CustomerPicker onSelect={setCustomer} source={channel} autoFocus />
            )}
            {errors.customer ? <p className="text-destructive text-sm">{errors.customer}</p> : null}
          </div>
        </AdminSection>

        <AdminSection title="Products">
          <NativeSelect
            aria-label="Add a product"
            value={picker}
            onChange={(e) => addVariant(e.target.value)}
            className="[&_select]:h-12"
          >
            <option value="">Add a product…</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.productName}
                {v.label ? ` · ${v.label}` : ""} — {formatAED(v.priceFils)} ({v.onHand} in stock)
              </option>
            ))}
          </NativeSelect>
          {errors.lines ? <p className="text-destructive mt-2 text-sm">{errors.lines}</p> : null}
          <ul className="mt-4 flex flex-col gap-3">
            {pricedLines.map((l) => (
              <li key={l.variantId} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.variant.productName}
                      {l.variant.label ? (
                        <span className="text-muted-foreground"> · {l.variant.label}</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <span className="font-mono">{l.variant.sku}</span> · {l.variant.onHand} in
                      stock
                      {l.qty > l.variant.onHand ? (
                        <span className="text-destructive"> · not enough stock</span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${l.variant.productName}`}
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x.variantId !== l.variantId))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="flex items-center rounded-md border">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      className="flex size-11 items-center justify-center disabled:opacity-40"
                      disabled={l.qty <= 1}
                      onClick={() => update(l.variantId, { qty: l.qty - 1 })}
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="numeric w-10 text-center font-medium" aria-live="polite">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      className="flex size-11 items-center justify-center"
                      onClick={() => update(l.variantId, { qty: l.qty + 1 })}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <Field label="Unit price (AED)" htmlFor={`price-${l.variantId}`} className="w-36">
                    <Input
                      id={`price-${l.variantId}`}
                      inputMode="decimal"
                      value={l.price}
                      disabled={!canOverride}
                      onChange={(e) => update(l.variantId, { price: e.target.value })}
                      className="numeric h-11"
                    />
                  </Field>
                  <p className="numeric ms-auto pb-2 font-medium">
                    {formatAED(l.unitFils * l.qty)}
                  </p>
                </div>
                {l.changed ? (
                  <Field
                    label="Reason for price change"
                    htmlFor={`reason-${l.variantId}`}
                    error={errors[`reason-${l.variantId}`]}
                    className="mt-3"
                  >
                    <Input
                      id={`reason-${l.variantId}`}
                      value={l.reason}
                      placeholder="e.g. Loyal customer, bundle offer"
                      onChange={(e) => update(l.variantId, { reason: e.target.value })}
                      className="h-11"
                    />
                  </Field>
                ) : null}
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection title="Fulfilment">
          <div className="flex flex-col gap-4">
            <Segmented
              label="Fulfilment"
              value={fulfilment}
              onChange={setFulfilment}
              options={[
                { value: "handed_over", label: "Handed over" },
                { value: "pickup", label: "Pickup" },
                { value: "delivery", label: "Delivery" },
              ]}
            />
            {fulfilment === "delivery" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Street, building or villa"
                  htmlFor="line1"
                  error={errors.address}
                  className="sm:col-span-2"
                >
                  <Input
                    id="line1"
                    value={address.line1}
                    onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Apartment, floor" htmlFor="line2">
                  <Input
                    id="line2"
                    value={address.line2}
                    onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Area" htmlFor="area">
                  <Input
                    id="area"
                    value={address.area}
                    onChange={(e) => setAddress({ ...address, area: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="City" htmlFor="city">
                  <Input
                    id="city"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label="Emirate" htmlFor="emirate" error={errors.emirate}>
                  <NativeSelect
                    id="emirate"
                    value={emirate}
                    onChange={(e) => {
                      setEmirate(e.target.value);
                      const z = zones.find((x) => x.emirate === e.target.value);
                      if (z) setFee(toAed(z.fee_fils));
                    }}
                    className="[&_select]:h-11"
                  >
                    <option value="">Choose…</option>
                    {zones.map((z) => (
                      <option key={z.emirate} value={z.emirate}>
                        {z.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Delivery fee (AED)" htmlFor="fee">
                  <Input
                    id="fee"
                    inputMode="decimal"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className="numeric h-11"
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </AdminSection>
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        {canRecordPayment ? (
          <AdminSection title="Payment">
            <div className="flex flex-col gap-4">
              <Segmented
                label="Payment"
                value={payMode}
                onChange={setPayMode}
                options={[
                  { value: "later", label: "Later" },
                  { value: "full", label: "Paid" },
                  { value: "partial", label: "Part" },
                ]}
              />
              {payMode !== "later" ? (
                <>
                  <Field label="Method" htmlFor="method">
                    <NativeSelect
                      id="method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as typeof method)}
                      className="[&_select]:h-11"
                    >
                      {MANUAL_PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  {payMode === "partial" ? (
                    <Field label="Amount received (AED)" htmlFor="amount" error={errors.amount}>
                      <Input
                        id="amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="numeric h-11"
                      />
                    </Field>
                  ) : null}
                  <Field label="Reference (optional)" htmlFor="reference">
                    <Input
                      id="reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Transfer ref, receipt no."
                      className="h-11"
                    />
                  </Field>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Send a payment link from the order once it&apos;s created.
                </p>
              )}
            </div>
          </AdminSection>
        ) : null}

        <AdminSection title="Summary">
          <dl className="numeric flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatAED(pricing.subtotalFils)}</dd>
            </div>
            {fulfilment === "delivery" ? (
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>{formatAED(feeFils)}</dd>
              </div>
            ) : null}
            <div className="text-muted-foreground flex justify-between">
              <dt>{pricing.vatIncluded ? "Includes VAT" : "VAT"}</dt>
              <dd>{formatAED(pricing.vatFils)}</dd>
            </div>
            <div className="mt-2 flex justify-between border-t pt-3 text-lg font-semibold">
              <dt>Total</dt>
              <dd>{formatAED(pricing.totalFils)}</dd>
            </div>
          </dl>
          <Button size="xl" className="mt-5 w-full" disabled={pending} onClick={submit}>
            {pending ? "Creating…" : "Create order"}
          </Button>
        </AdminSection>
      </aside>
    </div>
  );
}
