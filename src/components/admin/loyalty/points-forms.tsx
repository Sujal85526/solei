"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Cake, Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { filsToAed } from "@/lib/money";
import {
  runBirthdaysAction,
  saveRewardsSettingsAction,
  saveTiersAction,
} from "@/modules/points/actions";
import { tierFormValues, type RewardsSettings, type Tier } from "@/modules/points/schema";

/** Master switch, earning and spending rates, birthday bonus. */
export function RewardsSettingsForm({
  settings,
  canManage,
}: {
  settings: RewardsSettings;
  canManage: boolean;
}) {
  const [state, action, pending] = useFormAction(saveRewardsSettingsAction, null);
  const e = useActionToast(state);
  const [sending, start] = useTransition();
  return (
    <form {...action} noValidate className="flex flex-col gap-5">
      <fieldset disabled={!canManage} className="flex flex-col gap-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            <span className="font-medium">Points & tiers are on</span>
            <span className="text-muted-foreground block text-xs">
              Off: customers see nothing and earn nothing. Balances are kept. The Solei Passport is
              separate and keeps working either way.
            </span>
          </span>
        </label>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Points per AED 1"
            htmlFor="pointsPerAed"
            error={e.pointsPerAed}
            hint="On what's paid (not by gift card or points)"
            required
          >
            <Input
              id="pointsPerAed"
              name="pointsPerAed"
              inputMode="numeric"
              defaultValue={settings.pointsPerAed}
              className="numeric h-11"
            />
          </Field>
          <Field
            label="1 point is worth (AED)"
            htmlFor="pointValue"
            error={e.pointValue}
            hint="e.g. 0.05 → 100 points = AED 5"
            required
          >
            <Input
              id="pointValue"
              name="pointValue"
              inputMode="decimal"
              defaultValue={filsToAed(settings.pointValueFils)}
              className="numeric h-11"
            />
          </Field>
          <Field
            label="Spend from (points)"
            htmlFor="minRedeemPoints"
            error={e.minRedeemPoints}
            hint="Minimum to use at checkout"
            required
          >
            <Input
              id="minRedeemPoints"
              name="minRedeemPoints"
              inputMode="numeric"
              defaultValue={settings.minRedeemPoints}
              className="numeric h-11"
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[auto_12rem] sm:items-end">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="birthdayEnabled"
              defaultChecked={settings.birthdayEnabled}
              className="accent-primary mt-0.5 size-4"
            />
            <span>
              Birthday bonus
              <span className="text-muted-foreground block text-xs">
                On the customer&apos;s birthday (they add it in their account), with an email.
              </span>
            </span>
          </label>
          <Field label="Birthday points" htmlFor="birthdayPoints" error={e.birthdayPoints} required>
            <Input
              id="birthdayPoints"
              name="birthdayPoints"
              inputMode="numeric"
              defaultValue={settings.birthdayPoints}
              className="numeric h-11"
            />
          </Field>
        </div>
      </fieldset>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() =>
              start(async () => {
                const r = await runBirthdaysAction();
                if (r.ok) toast.success(r.message ?? "Done.");
                else toast.error(r.error);
              })
            }
          >
            <Cake /> {sending ? "Sending…" : "Send today's birthday bonuses"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

type Row = { key: number; name: string; minSpend: string; multiplier: string; perks: string };

/** Up to six tiers by 12-month spend; the first starts at AED 0. */
export function TiersForm({ tiers, canManage }: { tiers: Tier[]; canManage: boolean }) {
  const [state, action, pending] = useFormAction(saveTiersAction, null);
  useActionToast(state);
  const [rows, setRows] = useState<Row[]>(() =>
    tiers.map((t, i) => ({ key: i, ...tierFormValues(t) })),
  );
  const nextKey = () => Math.max(0, ...rows.map((r) => r.key)) + 1;
  return (
    <form {...action} noValidate className="flex flex-col gap-4">
      <div className="text-muted-foreground hidden grid-cols-[1fr_8rem_6rem_2fr_2.5rem] gap-3 text-xs font-medium sm:grid">
        <span>Tier</span>
        <span>From (AED, 12 months)</span>
        <span>Points ×</span>
        <span>Perks (shown to customers)</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_6rem_2fr_2.5rem] sm:border-0 sm:p-0"
        >
          <Input
            name="name"
            aria-label="Tier name"
            defaultValue={r.name}
            disabled={!canManage}
            className="col-span-2 h-10 sm:col-span-1"
          />
          <Input
            name="minSpend"
            aria-label="From (AED)"
            inputMode="decimal"
            defaultValue={r.minSpend}
            disabled={!canManage}
            className="numeric h-10"
          />
          <Input
            name="multiplier"
            aria-label="Points multiplier"
            inputMode="decimal"
            defaultValue={r.multiplier}
            disabled={!canManage}
            className="numeric h-10"
          />
          <Input
            name="perks"
            aria-label="Perks"
            defaultValue={r.perks}
            disabled={!canManage}
            className="col-span-2 h-10 sm:col-span-1"
          />
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${r.name || "tier"}`}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="self-center"
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ))}
      {state && !state.ok ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={rows.length >= 6}
            onClick={() =>
              setRows([
                ...rows,
                { key: nextKey(), name: "", minSpend: "", multiplier: "1", perks: "" },
              ])
            }
          >
            <Plus /> Add tier
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save tiers"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
