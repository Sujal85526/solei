"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatAED } from "@/lib/money";
import {
  deleteRewardAction,
  saveRewardAction,
  setRewardActiveAction,
} from "@/modules/points/actions";
import type { PointsReward } from "@/modules/promotions/schema";

type VariantOption = { id: string; label: string };

/** The points rewards catalogue: a product (size) for N points. */
export function RewardsCatalogue({
  rewards,
  variants,
  canManage,
}: {
  rewards: PointsReward[];
  /** Variants a reward can be (only loaded for managers). */
  variants: VariantOption[];
  canManage: boolean;
}) {
  /** null = no form open, "new" = adding, else the reward being edited. */
  const [editing, setEditing] = useState<PointsReward | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <div className="flex flex-col gap-4">
      {rewards.length ? (
        <Table aria-label="Points rewards">
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-end">Points</TableHead>
              <TableHead className="text-end">Value</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rewards.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium whitespace-normal">
                  {r.name}
                  {!r.variantActive ? (
                    <span className="text-muted-foreground block text-xs font-normal">
                      Product or size is hidden — customers don&apos;t see this reward.
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="numeric text-end">
                  {r.points.toLocaleString("en-GB")}
                </TableCell>
                <TableCell className="numeric text-end">{formatAED(r.priceFils)}</TableCell>
                <TableCell>
                  {canManage ? (
                    <ActiveSwitch reward={r} />
                  ) : (
                    <Badge variant={r.active ? "success" : "muted"}>
                      {r.active ? "On" : "Off"}
                    </Badge>
                  )}
                </TableCell>
                {canManage ? (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${r.name}`}
                        onClick={() => setEditing(r)}
                      >
                        <Pencil />
                      </Button>
                      <ConfirmButton
                        title="Remove this reward?"
                        description="Customers can no longer choose it. Orders that used it are kept."
                        confirmLabel="Remove"
                        destructive
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${r.name}`}
                        action={deleteRewardAction.bind(null, r.id)}
                      >
                        <Trash2 />
                      </ConfirmButton>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-muted-foreground text-sm">No rewards yet.</p>
      )}

      {canManage ? (
        editing ? (
          <RewardForm
            key={editing === "new" ? "new" : editing.id}
            reward={editing === "new" ? null : editing}
            variants={variants}
            taken={new Set(rewards.map((r) => r.variantId))}
            onDone={close}
          />
        ) : (
          <div>
            <Button type="button" variant="outline" onClick={() => setEditing("new")}>
              <Plus /> Add reward
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

function ActiveSwitch({ reward }: { reward: PointsReward }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={reward.active}
        disabled={pending}
        onChange={(ev) => {
          const active = ev.target.checked;
          start(async () => {
            const r = await setRewardActiveAction(reward.id, active);
            if (r.ok) toast.success(r.message ?? "Saved.");
            else toast.error(r.error);
          });
        }}
        className="accent-primary size-4"
        aria-label={`${reward.name} is on`}
      />
      {reward.active ? "On" : "Off"}
    </label>
  );
}

function RewardForm({
  reward,
  variants,
  taken,
  onDone,
}: {
  reward: PointsReward | null;
  variants: VariantOption[];
  /** Variants that already are a reward (one reward per product size). */
  taken: Set<string>;
  onDone: () => void;
}) {
  const [state, action, pending] = useFormAction(saveRewardAction, null);
  const e = useActionToast(state, onDone);
  const options = variants.filter((v) => v.id === reward?.variantId || !taken.has(v.id));
  // A reward on a product that is hidden now is still editable.
  const missing =
    reward && !variants.some((v) => v.id === reward.variantId)
      ? { id: reward.variantId, label: reward.name }
      : null;

  return (
    <form {...action} noValidate className="bg-muted/40 flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-sm font-medium">{reward ? "Edit reward" : "New reward"}</p>
      {reward ? <input type="hidden" name="id" value={reward.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Product" htmlFor="reward-variant" error={e.variantId} required>
          <NativeSelect
            id="reward-variant"
            name="variantId"
            defaultValue={reward?.variantId ?? ""}
            className="[&_button]:h-11"
          >
            <option value="" disabled>
              Choose…
            </option>
            {missing ? <option value={missing.id}>{missing.label}</option> : null}
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Points" htmlFor="reward-points" error={e.points} required>
          <Input
            id="reward-points"
            name="points"
            inputMode="numeric"
            defaultValue={reward?.points ?? ""}
            className="numeric h-11"
          />
        </Field>
        <Field label="Sort order" htmlFor="reward-sort" error={e.sort} hint="Lower shows first.">
          <Input
            id="reward-sort"
            name="sort"
            type="number"
            min={0}
            defaultValue={reward?.sort ?? 0}
            className="numeric h-11"
          />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={reward?.active ?? true}
          className="accent-primary size-4"
        />
        Customers can choose it
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : reward ? "Save reward" : "Add reward"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
