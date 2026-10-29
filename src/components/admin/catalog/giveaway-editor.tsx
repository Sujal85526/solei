"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { filsToAed, formatAED } from "@/lib/money";
import { saveGiveawayAction } from "@/modules/giveaways/actions";
import type { BottleOption, GiveawaySettings } from "@/modules/giveaways/admin-queries";

type ItemDraft = { variantId: string; price: string; active: boolean };

/**
 * Giveaway settings of a product: whether it is sold as a giveaway (Giveaways page, guided order),
 * its occasions, and the real bottles customers choose from (a variant of a perfume or spray, so
 * stock counts) — each at its own price or a giveaway price. Product types in the guided order are
 * the bottles' categories; packaging and personalisation are the Customisation choices.
 */
export function GiveawayEditor({
  productId,
  settings,
  occasions,
  bottles,
  canManage,
}: {
  productId: string;
  settings: GiveawaySettings;
  occasions: { id: string; name: string; active: boolean }[];
  bottles: BottleOption[];
  canManage: boolean;
}) {
  const [isGiveaway, setIsGiveaway] = useState(settings.isGiveaway);
  const [occasionIds, setOccasionIds] = useState(settings.occasionIds);
  const [items, setItems] = useState<ItemDraft[]>(
    settings.items.map((i) => ({
      variantId: i.variantId,
      price: i.priceFils === null ? "" : String(filsToAed(i.priceFils)),
      active: i.active,
    })),
  );
  const [adding, setAdding] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(bottles.map((b) => [b.variantId, b]));
  const categories = [...new Set(bottles.map((b) => b.category))];
  const update = (variantId: string, patch: Partial<ItemDraft>) =>
    setItems(items.map((i) => (i.variantId === variantId ? { ...i, ...patch } : i)));

  function save() {
    setError(null);
    start(async () => {
      const res = await saveGiveawayAction({ productId, isGiveaway, occasionIds, items });
      if (res.ok) toast.success(res.message ?? "Saved.");
      else setError(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={isGiveaway}
          disabled={!canManage}
          onChange={(e) => setIsGiveaway(e.target.checked)}
          className="accent-primary mt-0.5 size-5"
        />
        <span>
          <span className="font-medium">Sell this as a giveaway</span>
          <span className="text-muted-foreground block">
            It shows on the Giveaways page with the guided order: product type → scent → packaging →
            quantity → personalisation.
          </span>
        </span>
      </label>

      {isGiveaway ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Occasions</legend>
            {occasions.length ? (
              <div className="flex flex-wrap gap-2">
                {occasions.map((o) => {
                  const on = occasionIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!canManage}
                        onChange={() =>
                          setOccasionIds(
                            on ? occasionIds.filter((x) => x !== o.id) : [...occasionIds, o.id],
                          )
                        }
                        className="accent-primary size-4"
                      />
                      {o.name}
                      {o.active ? null : <span className="text-muted-foreground">(hidden)</span>}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No occasions yet — add them under Products → Occasions.
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Bottles customers choose from</p>
            <p className="text-muted-foreground text-xs">
              Real products, so stock and reports count them. Leave the price empty to use the
              bottle&apos;s own price.
            </p>
            {items.length ? (
              <ul className="divide-y rounded-lg border">
                {items.map((i) => {
                  const b = byId.get(i.variantId);
                  return (
                    <li
                      key={i.variantId}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm sm:grid-cols-[1fr_7rem_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b?.label ?? "Removed product"}</p>
                        <p className="text-muted-foreground text-xs">
                          {b ? `${b.category} · ${formatAED(b.priceFils)}` : ""}
                          {b && !b.active ? " · not on sale" : ""}
                        </p>
                      </div>
                      <Input
                        aria-label="Giveaway price (AED)"
                        inputMode="decimal"
                        value={i.price}
                        disabled={!canManage}
                        onChange={(e) => update(i.variantId, { price: e.target.value })}
                        placeholder={b ? String(filsToAed(b.priceFils)) : "AED"}
                        className="numeric order-3 h-10 sm:order-none"
                      />
                      <label className="order-4 flex items-center gap-1.5 text-xs sm:order-none">
                        <input
                          type="checkbox"
                          checked={i.active}
                          disabled={!canManage}
                          onChange={(e) => update(i.variantId, { active: e.target.checked })}
                          className="accent-primary size-4"
                        />
                        Shown
                      </label>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${b?.label ?? "bottle"}`}
                          onClick={() => setItems(items.filter((x) => x.variantId !== i.variantId))}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <NativeSelect
                  aria-label="Add a bottle"
                  value={adding}
                  onChange={(e) => setAdding(e.target.value)}
                  className="min-w-0 flex-1 [&_select]:h-10"
                >
                  <option value="">Add a bottle…</option>
                  {categories.map((c) => (
                    <optgroup key={c} label={c || "Other"}>
                      {bottles
                        .filter(
                          (b) =>
                            b.category === c && !items.some((i) => i.variantId === b.variantId),
                        )
                        .map((b) => (
                          <option key={b.variantId} value={b.variantId}>
                            {b.label} · {formatAED(b.priceFils)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </NativeSelect>
                <Button
                  variant="outline"
                  disabled={!adding}
                  onClick={() => {
                    setItems([...items, { variantId: adding, price: "", active: true }]);
                    setAdding("");
                  }}
                >
                  <Plus /> Add
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {canManage ? (
        <Button className="self-start" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save giveaway"}
        </Button>
      ) : null}
    </div>
  );
}
