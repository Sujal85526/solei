"use client";

import { useCallback, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import {
  deleteConfigAction,
  saveBookingSettingsAction,
  saveConfigAction,
} from "@/modules/bookings/actions";
import type { ConfigKind } from "@/modules/bookings/schema";

export type ConfigItem = {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  description?: string | null;
  inclusions?: string[];
  base_price_fils?: number;
  images?: string[];
  photos?: string[];
  hex?: string;
  price_fils?: number;
};

type FieldDef =
  | { key: "description"; label: string; type: "textarea" }
  | { key: "inclusions" | "images" | "photos"; label: string; type: "lines"; hint: string }
  | {
      key: "basePrice" | "price";
      label: string;
      type: "aed";
      from: "base_price_fils" | "price_fils";
    }
  | { key: "hex"; label: string; type: "color" };

const FIELDS: Record<ConfigKind, FieldDef[]> = {
  eventType: [],
  service: [{ key: "description", label: "Description", type: "textarea" }],
  package: [
    { key: "description", label: "Description", type: "textarea" },
    { key: "inclusions", label: "Inclusions", type: "lines", hint: "One per line." },
    { key: "basePrice", label: "Starting price (AED)", type: "aed", from: "base_price_fils" },
    {
      key: "images",
      label: "Image URLs",
      type: "lines",
      hint: "One per line — /images/… or https://…; the first is the cover.",
    },
  ],
  booth: [
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "photos",
      label: "Photo URLs",
      type: "lines",
      hint: "One per line — /images/… or https://…; the first is the cover.",
    },
  ],
  flower: [
    { key: "hex", label: "Colour", type: "color" },
    { key: "price", label: "Surcharge on the base price (AED)", type: "aed", from: "price_fils" },
  ],
};

/** List + add/edit dialog for one kind of booking option. */
export function ConfigEditor({
  kind,
  title,
  noun,
  items,
}: {
  kind: ConfigKind;
  title: string;
  noun: string;
  items: ConfigItem[];
}) {
  const [editing, setEditing] = useState<ConfigItem | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);
  return (
    <section aria-labelledby={`cfg-${kind}`} className="bg-card rounded-xl border p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`cfg-${kind}`} className="text-foreground font-sans text-base font-semibold">
          {title}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add {noun}
        </Button>
      </header>
      <ul className="divide-y">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-3">
            {it.hex ? (
              <span
                aria-hidden
                className="size-6 shrink-0 rounded-full border"
                style={{ backgroundColor: it.hex }}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {it.name}
                {!it.active ? <Badge variant="muted">Hidden</Badge> : null}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {[
                  it.base_price_fils !== undefined ? formatAED(it.base_price_fils) : null,
                  it.price_fils !== undefined ? `+${formatAED(it.price_fils)}` : null,
                  it.inclusions?.length ? `${it.inclusions.length} inclusions` : null,
                  it.description,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${it.name}`}
              onClick={() => setEditing(it)}
            >
              <Pencil />
            </Button>
            <ConfirmButton
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${it.name}`}
              title={`Delete ${it.name}?`}
              description="Options used by existing bookings can't be deleted — hide them instead."
              confirmLabel="Delete"
              destructive
              action={deleteConfigAction.bind(null, kind, it.id)}
            >
              <Trash2 />
            </ConfirmButton>
          </li>
        ))}
      </ul>
      {!items.length ? <p className="text-muted-foreground text-sm">None yet.</p> : null}
      {editing ? (
        <ConfigDialog
          key={editing === "new" ? "new" : editing.id}
          kind={kind}
          noun={noun}
          item={editing === "new" ? undefined : editing}
          onClose={close}
        />
      ) : null}
    </section>
  );
}

function ConfigDialog({
  kind,
  noun,
  item,
  onClose,
}: {
  kind: ConfigKind;
  noun: string;
  item?: ConfigItem;
  onClose: () => void;
}) {
  const action = useMemo(() => saveConfigAction.bind(null, kind), [kind]);
  const [state, form, pending] = useFormAction(action, null);
  const e = useActionToast(state, onClose);
  const id = (k: string) => `${kind}-${k}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${item.name}` : `New ${noun}`}</DialogTitle>
        </DialogHeader>
        <form {...form} className="flex flex-col gap-4" noValidate>
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <Field label="Name" htmlFor={id("name")} error={e.name} required>
            <Input id={id("name")} name="name" defaultValue={item?.name} className="h-11" />
          </Field>
          {FIELDS[kind].map((f) => {
            const fid = id(f.key);
            if (f.type === "textarea")
              return (
                <Field key={f.key} label={f.label} htmlFor={fid} error={e[f.key]}>
                  <Textarea id={fid} name={f.key} rows={2} defaultValue={item?.description ?? ""} />
                </Field>
              );
            if (f.type === "lines")
              return (
                <Field
                  key={f.key}
                  label={f.label}
                  htmlFor={fid}
                  error={Object.entries(e).find(([k]) => k.startsWith(f.key))?.[1]}
                  hint={f.hint}
                >
                  <Textarea
                    id={fid}
                    name={f.key}
                    rows={4}
                    defaultValue={(item?.[f.key] ?? []).join("\n")}
                  />
                </Field>
              );
            if (f.type === "aed")
              return (
                <Field key={f.key} label={f.label} htmlFor={fid} error={e[f.key]}>
                  <Input
                    id={fid}
                    name={f.key}
                    inputMode="decimal"
                    defaultValue={String((item?.[f.from] ?? 0) / 100)}
                    className="h-11"
                  />
                </Field>
              );
            return (
              <Field key={f.key} label={f.label} htmlFor={fid} error={e.hex}>
                <Input
                  id={fid}
                  name="hex"
                  type="color"
                  defaultValue={item?.hex ?? "#F7CDD0"}
                  className="h-11 w-24 p-1"
                />
              </Field>
            );
          })}
          <Field label="Order" htmlFor={id("sort")} error={e.sort} hint="Lower numbers come first.">
            <Input
              id={id("sort")}
              name="sort"
              type="number"
              defaultValue={item?.sort ?? 100}
              className="h-11 w-32"
            />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={item?.active ?? true}
              className="accent-burgundy size-5"
            />
            Shown on the website
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deposit %, flower base price and quote validity. */
export function BookingSettingsForm({
  depositBp,
  flowerBaseFils,
  validityDays,
}: {
  depositBp: number;
  flowerBaseFils: number;
  validityDays: number;
}) {
  const [state, form, pending] = useFormAction(saveBookingSettingsAction, null);
  const e = useActionToast(state);
  return (
    <form {...form} noValidate className="grid gap-4 sm:grid-cols-3">
      <Field
        label="Default deposit (%)"
        htmlFor="depositPercent"
        error={e.depositPercent}
        hint="Pre-filled on new quotes."
      >
        <Input
          id="depositPercent"
          name="depositPercent"
          inputMode="decimal"
          defaultValue={String(depositBp / 100)}
          className="h-11"
        />
      </Field>
      <Field
        label="Flower base price (AED)"
        htmlFor="flowerBase"
        error={e.flowerBase}
        hint="Each colour adds its surcharge."
      >
        <Input
          id="flowerBase"
          name="flowerBase"
          inputMode="decimal"
          defaultValue={String(flowerBaseFils / 100)}
          className="h-11"
        />
      </Field>
      <Field label="Quote valid for (days)" htmlFor="validityDays" error={e.validityDays}>
        <Input
          id="validityDays"
          name="validityDays"
          type="number"
          defaultValue={validityDays}
          className="h-11"
        />
      </Field>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
