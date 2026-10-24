"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
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
import { useFormAction } from "@/hooks/use-form-action";
import {
  deleteOptionGroupAction,
  saveOptionGroupAction,
  setMinOrderQtyAction,
} from "@/modules/catalog/actions";
import { deltaText, type OptionGroupKind } from "@/modules/catalog/options";

export type OptionGroupRow = {
  id: string;
  name: string;
  kind: OptionGroupKind;
  required: boolean;
  max_length: number;
  product_options: { id: string; label: string; price_delta_fils: number; active: boolean }[];
};

const KIND_LABELS: Record<OptionGroupKind, string> = {
  single: "Pick one",
  multi: "Pick any",
  text: "Text (e.g. a name)",
};

/**
 * Giveaways: what the customer chooses on this product (ribbon colour, box, a name on the tag…)
 * with a price change per option, and the fewest pieces per order.
 */
export function OptionsEditor({
  productId,
  groups,
  minOrderQty,
  canManage,
}: {
  productId: string;
  groups: OptionGroupRow[];
  minOrderQty: number;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<OptionGroupRow | "new" | null>(null);
  const [minState, minAction, minPending] = useFormAction(setMinOrderQtyAction, null);
  const e = useActionToast(minState);
  return (
    <div className="flex flex-col gap-5">
      <form {...minAction} className="flex flex-wrap items-end gap-3" noValidate>
        <input type="hidden" name="productId" value={productId} />
        <Field
          label="Minimum per order"
          htmlFor="minOrderQty"
          error={e.minOrderQty}
          hint="Pieces. 1 for an ordinary product; e.g. 20 for wedding giveaways."
        >
          <Input
            id="minOrderQty"
            name="minOrderQty"
            inputMode="numeric"
            defaultValue={minOrderQty}
            disabled={!canManage}
            className="numeric h-10 w-28"
          />
        </Field>
        {canManage ? (
          <Button type="submit" variant="outline" disabled={minPending}>
            Save
          </Button>
        ) : null}
      </form>

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No choices — customers buy it as it is. Add one to make it customisable.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {groups.map((g) => (
            <li key={g.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {g.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {KIND_LABELS[g.kind]}
                    {g.required ? "" : " · optional"}
                  </span>
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {g.kind === "text"
                    ? `Up to ${g.max_length} characters`
                    : g.product_options
                        .map(
                          (o) =>
                            `${o.label}${o.price_delta_fils ? ` ${deltaText(o.price_delta_fils)}` : ""}${o.active ? "" : " (hidden)"}`,
                        )
                        .join(" · ")}
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${g.name}`}
                    onClick={() => setEditing(g)}
                  >
                    <Pencil />
                  </Button>
                  <ConfirmButton
                    variant="ghost"
                    size="icon-sm"
                    destructive
                    aria-label={`Remove ${g.name}`}
                    title={`Remove “${g.name}”?`}
                    description="Customers stop seeing it. Past orders keep what was chosen."
                    confirmLabel="Remove"
                    action={() => deleteOptionGroupAction(g.id)}
                  >
                    <Trash2 />
                  </ConfirmButton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <Button variant="outline" className="self-start" onClick={() => setEditing("new")}>
          <Plus /> Add a choice
        </Button>
      ) : null}
      {editing ? (
        <GroupDialog
          productId={productId}
          group={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

type OptionDraft = { key: number; id?: string; label: string; priceDelta: string; active: boolean };

function GroupDialog({
  productId,
  group,
  onClose,
}: {
  productId: string;
  group: OptionGroupRow | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [kind, setKind] = useState<OptionGroupKind>(group?.kind ?? "single");
  const [required, setRequired] = useState(group?.required ?? true);
  const [maxLength, setMaxLength] = useState(String(group?.max_length ?? 40));
  const [options, setOptions] = useState<OptionDraft[]>(
    group?.product_options.map((o, i) => ({
      key: i,
      id: o.id,
      label: o.label,
      priceDelta: o.price_delta_fils ? String(o.price_delta_fils / 100) : "",
      active: o.active,
    })) ?? [{ key: 0, label: "", priceDelta: "", active: true }],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nextKey = () => Math.max(0, ...options.map((o) => o.key)) + 1;
  const update = (key: number, patch: Partial<OptionDraft>) =>
    setOptions(options.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  function save() {
    setError(null);
    start(async () => {
      const res = await saveOptionGroupAction({
        id: group?.id,
        productId,
        name,
        kind,
        required,
        maxLength,
        options:
          kind === "text"
            ? []
            : options.map((o) => ({
                id: o.id,
                label: o.label,
                priceDelta: o.priceDelta,
                active: o.active,
              })),
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        onClose();
      } else {
        setError(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? `Edit “${group.name}”` : "Add a choice"}</DialogTitle>
          <DialogDescription>
            Price changes are per piece and can be negative (e.g. a smaller box).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ogName" required>
            <Input
              id="ogName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ribbon"
              className="h-11"
            />
          </Field>
          <Field label="Type" htmlFor="ogKind">
            <NativeSelect
              id="ogKind"
              value={kind}
              onChange={(e) => setKind(e.target.value as OptionGroupKind)}
              className="[&_select]:h-11"
            >
              {(Object.keys(KIND_LABELS) as OptionGroupKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="accent-primary size-4"
            />
            The customer must answer this
          </label>
          {kind === "text" ? (
            <Field label="Longest answer (characters)" htmlFor="ogMax">
              <Input
                id="ogMax"
                inputMode="numeric"
                value={maxLength}
                onChange={(e) => setMaxLength(e.target.value)}
                className="numeric h-11"
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <p className="text-sm font-medium">Options</p>
              {options.map((o) => (
                <div
                  key={o.key}
                  className="grid grid-cols-[1fr_6.5rem_auto_auto] items-center gap-2"
                >
                  <Input
                    aria-label="Option"
                    value={o.label}
                    onChange={(e) => update(o.key, { label: e.target.value })}
                    placeholder="e.g. Gold"
                    className="h-10"
                  />
                  <Input
                    aria-label="Price change (AED)"
                    inputMode="decimal"
                    value={o.priceDelta}
                    onChange={(e) => update(o.key, { priceDelta: e.target.value })}
                    placeholder="+ AED"
                    className="numeric h-10"
                  />
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={o.active}
                      onChange={(e) => update(o.key, { active: e.target.checked })}
                      className="accent-primary size-4"
                    />
                    Shown
                  </label>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${o.label || "option"}`}
                    disabled={options.length === 1}
                    onClick={() => setOptions(options.filter((x) => x.key !== o.key))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                className="self-start"
                onClick={() =>
                  setOptions([
                    ...options,
                    { key: nextKey(), label: "", priceDelta: "", active: true },
                  ])
                }
              >
                <Plus /> Add option
              </Button>
              {group ? null : (
                <Badge variant="muted" className="self-start">
                  Shown on the product page in this order
                </Badge>
              )}
            </div>
          )}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button size="lg" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
