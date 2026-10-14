"use client";

import { useActionState, useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatAED } from "@/lib/money";
import { deleteVariantAction, saveVariantAction } from "@/modules/catalog/actions";

export type VariantRow = {
  id: string;
  label: string;
  size_ml: number | null;
  sku: string;
  barcode: string | null;
  price_fils: number;
  low_stock_threshold: number | null;
  active: boolean;
  cost_fils?: number | null;
  onHand: number;
};

const toAed = (fils: number | null | undefined) =>
  fils == null ? "" : (fils / 100).toFixed(2).replace(/\.00$/, "");

export function VariantsEditor({
  productId,
  variants,
  canSeeCost,
}: {
  productId: string;
  variants: VariantRow[];
  canSeeCost: boolean;
}) {
  const [editing, setEditing] = useState<VariantRow | "new" | null>(null);
  return (
    <>
      <ul className="divide-y rounded-lg border">
        {variants.length === 0 ? (
          <li className="text-muted-foreground p-4 text-sm">
            No variants yet — add a size to start selling.
          </li>
        ) : null}
        {variants.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {v.label || "Default"}
                {!v.active ? <Badge variant="muted">Inactive</Badge> : null}
              </p>
              <p className="text-muted-foreground font-mono text-xs">{v.sku}</p>
            </div>
            <div className="text-end text-sm">
              <p className="numeric font-medium">{formatAED(v.price_fils)}</p>
              {canSeeCost && v.cost_fils != null ? (
                <p className="numeric text-muted-foreground text-xs">
                  cost {formatAED(v.cost_fils)}
                </p>
              ) : null}
            </div>
            <Link
              href={`/admin/inventory/${v.id}`}
              className="numeric text-burgundy w-20 text-end text-sm underline-offset-4 hover:underline"
            >
              {v.onHand} in stock
            </Link>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditing(v)}
                aria-label={`Edit ${v.sku}`}
              >
                <Pencil />
              </Button>
              <ConfirmButton
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${v.sku}`}
                title={`Delete ${v.sku}?`}
                description="Only variants without stock or sales history can be deleted."
                confirmLabel="Delete"
                destructive
                action={() => deleteVariantAction(v.id)}
              >
                <Trash2 />
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" onClick={() => setEditing("new")}>
        <Plus /> Add variant
      </Button>
      {editing ? (
        <VariantDialog
          key={editing === "new" ? "new" : editing.id}
          productId={productId}
          variant={editing === "new" ? undefined : editing}
          canSeeCost={canSeeCost}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function VariantDialog({
  productId,
  variant,
  canSeeCost,
  onClose,
}: {
  productId: string;
  variant?: VariantRow;
  canSeeCost: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(saveVariantAction, null);
  const e = useActionToast(
    state,
    useCallback(() => onClose(), [onClose]),
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{variant ? `Edit ${variant.sku}` : "New variant"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
          <input type="hidden" name="productId" value={productId} />
          {variant ? <input type="hidden" name="id" value={variant.id} /> : null}
          <Field label="Size (ml)" htmlFor="sizeMl" error={e.sizeMl}>
            <Input
              id="sizeMl"
              name="sizeMl"
              type="number"
              min={1}
              defaultValue={variant?.size_ml ?? ""}
              className="h-11"
            />
          </Field>
          <Field
            label="Label"
            htmlFor="label"
            error={e.label}
            hint="Defaults to the size, e.g. “50 ml”"
          >
            <Input id="label" name="label" defaultValue={variant?.label} className="h-11" />
          </Field>
          <Field label="SKU" htmlFor="sku" error={e.sku} required>
            <Input
              id="sku"
              name="sku"
              defaultValue={variant?.sku}
              placeholder="SOL-P-CAP-50"
              className="h-11 font-mono uppercase"
            />
          </Field>
          <Field label="Barcode" htmlFor="barcode" error={e.barcode}>
            <Input
              id="barcode"
              name="barcode"
              defaultValue={variant?.barcode ?? ""}
              inputMode="numeric"
              className="h-11"
            />
          </Field>
          <Field label="Price (AED, incl. VAT)" htmlFor="price" error={e.price} required>
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              defaultValue={toAed(variant?.price_fils)}
              className="numeric h-11"
            />
          </Field>
          {canSeeCost ? (
            <Field
              label="Unit cost (AED)"
              htmlFor="cost"
              error={e.cost}
              hint="Used for COGS and profit. Only finance roles see it."
            >
              <Input
                id="cost"
                name="cost"
                inputMode="decimal"
                defaultValue={toAed(variant?.cost_fils)}
                className="numeric h-11"
              />
            </Field>
          ) : null}
          <Field
            label="Low-stock alert at"
            htmlFor="lowStockThreshold"
            error={e.lowStockThreshold}
            hint="Empty = business default"
          >
            <Input
              id="lowStockThreshold"
              name="lowStockThreshold"
              type="number"
              min={0}
              defaultValue={variant?.low_stock_threshold ?? ""}
              className="h-11"
            />
          </Field>
          <label className="flex items-center gap-3 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={variant?.active ?? true}
              className="accent-burgundy size-5"
            />
            Active
          </label>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
