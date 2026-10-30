"use client";

import { useFormAction } from "@/hooks/use-form-action";

import { useCallback, useState } from "react";
import { ArrowLeftRight, MinusCircle, PackagePlus } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  adjustStockAction,
  receiveStockAction,
  transferStockAction,
} from "@/modules/inventory/actions";

export type VariantOption = { id: string; label: string; sku: string; active: boolean };
export type LocationOption = { id: string; name: string; kind: string };
type Mode = "receive" | "adjust" | "transfer";

const titles: Record<Mode, { title: string; description: string; cta: string }> = {
  receive: {
    title: "Add stock",
    description: "New units that arrived — a delivery or a new batch — added to a location.",
    cta: "Add stock",
  },
  adjust: {
    title: "Damage or correction",
    description: "Record breakages or fix the count after a stock take. A reason is required.",
    cta: "Save adjustment",
  },
  transfer: {
    title: "Transfer stock",
    description: "Move units between locations, e.g. to an event.",
    cta: "Transfer",
  },
};

export function StockActions({
  variants,
  locations,
  defaultVariantId,
  can,
}: {
  variants: VariantOption[];
  locations: LocationOption[];
  defaultVariantId?: string;
  can: { receive: boolean; adjust: boolean; transfer: boolean };
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const close = useCallback(() => setMode(null), []);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {can.receive ? (
          <Button onClick={() => setMode("receive")}>
            <PackagePlus /> Add stock
          </Button>
        ) : null}
        {can.transfer ? (
          <Button variant="outline" onClick={() => setMode("transfer")}>
            <ArrowLeftRight /> Transfer
          </Button>
        ) : null}
        {can.adjust ? (
          <Button variant="outline" onClick={() => setMode("adjust")}>
            <MinusCircle /> Damage / correction
          </Button>
        ) : null}
      </div>
      {mode ? (
        <StockDialog
          key={mode}
          mode={mode}
          variants={variants}
          locations={locations}
          defaultVariantId={defaultVariantId}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function StockDialog({
  mode,
  variants,
  locations,
  defaultVariantId,
  onClose,
}: {
  mode: Mode;
  variants: VariantOption[];
  locations: LocationOption[];
  defaultVariantId?: string;
  onClose: () => void;
}) {
  const actionFor = {
    receive: receiveStockAction,
    adjust: adjustStockAction,
    transfer: transferStockAction,
  }[mode];
  const [state, action, pending] = useFormAction(actionFor, null);
  const e = useActionToast(state, onClose);
  const t = titles[mode];
  const defaultLocation = locations[0]?.id ?? "";

  const variantSelect = (
    <Field
      label="Product"
      htmlFor="variantId"
      error={e.variantId}
      required
      className="sm:col-span-2"
    >
      <NativeSelect
        id="variantId"
        name="variantId"
        defaultValue={defaultVariantId ?? ""}
        className="[&_button]:h-11"
      >
        <option value="" disabled>
          Choose a product…
        </option>
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} — {v.sku}
            {v.active ? "" : " (inactive)"}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
  const locationSelect = (name: string, label: string, def = defaultLocation) => (
    <Field label={label} htmlFor={name} error={e[name]} required>
      <NativeSelect id={name} name={name} defaultValue={def} className="[&_button]:h-11">
        <option value="" disabled>
          Choose…
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.kind === "event" ? " (event)" : ""}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <form {...action} className="grid gap-4 sm:grid-cols-2" noValidate>
          {variantSelect}
          {mode === "transfer" ? (
            <>
              {locationSelect("fromLocationId", "From")}
              {locationSelect("toLocationId", "To", locations[1]?.id ?? "")}
            </>
          ) : (
            locationSelect("locationId", "Location")
          )}
          {mode === "adjust" ? (
            <Field label="Type" htmlFor="kind" error={e.kind} required>
              <NativeSelect id="kind" name="kind" defaultValue="damage" className="[&_button]:h-11">
                <option value="damage">Damaged / broken (−)</option>
                <option value="correction_remove">Count correction (−)</option>
                <option value="correction_add">Count correction (+)</option>
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Units" htmlFor="qty" error={e.qty} required>
            <Input
              id="qty"
              name="qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="numeric h-11"
            />
          </Field>
          <Field
            label={mode === "adjust" ? "Reason" : "Note"}
            htmlFor="reason"
            error={e.reason}
            required={mode === "adjust"}
            className="sm:col-span-2"
          >
            <Input
              id="reason"
              name="reason"
              placeholder={
                mode === "receive"
                  ? "e.g. Supplier delivery #42"
                  : mode === "adjust"
                    ? "e.g. Broken in transit"
                    : ""
              }
              className="h-11"
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : t.cta}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
