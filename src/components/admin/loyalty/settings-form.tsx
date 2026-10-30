"use client";

import { useState } from "react";
import { Field, fieldAria } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import type { RewardType } from "@/modules/loyalty/engine";
import { saveSettingsAction } from "@/modules/loyalty/actions";
import { rewardTypeLabels, rewardTypes } from "@/modules/loyalty/schema";

type Option = { id: string; name: string };

export type SettingsValues = {
  enabled: boolean;
  stampsPerItem: number;
  qualifyingCategoryIds: string[];
  qualifyingProductIds: string[];
  stampsForReward: number;
  rewardType: RewardType;
  rewardConfig: Record<string, unknown>;
  rewardLabel: string;
  issuePassportAfterPurchases: number | null;
  rewardItemsEarnStamps: boolean;
  expiryMonths: number | null;
};

function Check({
  name,
  value,
  defaultChecked,
  label,
  hint,
  onChange,
}: {
  name: string;
  value?: string;
  defaultChecked?: boolean;
  label: string;
  hint?: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 py-1 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value ?? "on"}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="accent-burgundy mt-0.5 size-5 shrink-0"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground block text-xs">{hint}</span> : null}
      </span>
    </label>
  );
}

function CheckList({
  name,
  options,
  selected,
  error,
  legend,
}: {
  name: string;
  options: Option[];
  selected: readonly string[];
  error?: string;
  legend: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="max-h-56 overflow-y-auto rounded-lg border px-3 py-1">
        {options.map((o) => (
          <Check
            key={o.id}
            name={name}
            value={o.id}
            label={o.name}
            defaultChecked={selected.includes(o.id)}
          />
        ))}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </fieldset>
  );
}

/** Programme settings. Saving any rule change creates a new version effective now. */
export function LoyaltySettingsForm({
  values,
  categories,
  products,
}: {
  values: SettingsValues;
  categories: Option[];
  products: Option[];
}) {
  const [state, formProps, pending] = useFormAction(saveSettingsAction, null);
  const errors = useActionToast(state);
  const [qualifying, setQualifying] = useState<"all" | "some">(
    values.qualifyingCategoryIds.length || values.qualifyingProductIds.length ? "some" : "all",
  );
  const [rewardType, setRewardType] = useState<RewardType>(values.rewardType);
  const [passportAuto, setPassportAuto] = useState(values.issuePassportAfterPurchases !== null);
  const [expires, setExpires] = useState(values.expiryMonths !== null);
  const cfg = values.rewardConfig;

  return (
    <form {...formProps} className="flex flex-col gap-6" noValidate>
      <Check
        name="enabled"
        defaultChecked={values.enabled}
        label="Programme is on"
        hint="When off, no stamps are awarded and no rewards unlock. Existing stamps are kept."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Stamps per qualifying item"
          htmlFor="stampsPerItem"
          error={errors.stampsPerItem}
        >
          <Input
            {...fieldAria("stampsPerItem", errors.stampsPerItem)}
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={values.stampsPerItem}
            className="h-11"
          />
        </Field>
        <Field
          label="Stamps needed for a reward"
          htmlFor="stampsForReward"
          error={errors.stampsForReward}
        >
          <Input
            {...fieldAria("stampsForReward", errors.stampsForReward)}
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            defaultValue={values.stampsForReward}
            className="h-11"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Which purchases earn stamps</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "some"] as const).map((q) => (
            <label
              key={q}
              className="has-[:checked]:border-burgundy has-[:checked]:bg-burgundy/5 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm"
            >
              <input
                type="radio"
                name="qualifying"
                value={q}
                checked={qualifying === q}
                onChange={() => setQualifying(q)}
                className="accent-burgundy"
              />
              {q === "all" ? "Every product" : "Only some categories / products"}
            </label>
          ))}
        </div>
        {qualifying === "some" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckList
              name="qualifyingCategoryIds"
              legend="Categories"
              options={categories}
              selected={values.qualifyingCategoryIds}
              error={errors.qualifyingCategoryIds}
            />
            <CheckList
              name="qualifyingProductIds"
              legend="Products"
              options={products}
              selected={values.qualifyingProductIds}
            />
          </div>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-4">
        <Field label="Reward" htmlFor="rewardType" error={errors.rewardType}>
          <NativeSelect
            {...fieldAria("rewardType", errors.rewardType)}
            value={rewardType}
            onChange={(e) => setRewardType(e.target.value as RewardType)}
            className="[&_button]:h-11"
          >
            {rewardTypes.map((t) => (
              <option key={t} value={t}>
                {rewardTypeLabels[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {rewardType === "choose_from_category" ? (
          <Field label="Reward category" htmlFor="rewardCategoryId" error={errors.rewardCategoryId}>
            <NativeSelect
              {...fieldAria("rewardCategoryId", errors.rewardCategoryId)}
              defaultValue={String(cfg.category_id ?? "")}
              className="[&_button]:h-11"
            >
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : rewardType === "specific_products" ? (
          <CheckList
            name="rewardProductIds"
            legend="Reward products (customer picks one)"
            options={products}
            selected={Array.isArray(cfg.product_ids) ? (cfg.product_ids as string[]) : []}
            error={errors.rewardProductIds}
          />
        ) : rewardType === "fixed_amount" ? (
          <Field
            label="Amount off (AED)"
            htmlFor="rewardAmountAed"
            error={errors.rewardAmountAed}
            hint="Staff apply it on the order the reward is used on."
          >
            <Input
              {...fieldAria("rewardAmountAed", errors.rewardAmountAed)}
              inputMode="decimal"
              defaultValue={cfg.amount_fils ? String(Number(cfg.amount_fils) / 100) : ""}
              className="h-11"
            />
          </Field>
        ) : (
          <Field
            label="Percentage off"
            htmlFor="rewardPercent"
            error={errors.rewardPercent}
            hint="Staff apply it on the order the reward is used on."
          >
            <Input
              {...fieldAria("rewardPercent", errors.rewardPercent)}
              inputMode="decimal"
              defaultValue={cfg.percent_bp ? String(Number(cfg.percent_bp) / 100) : ""}
              className="h-11"
            />
          </Field>
        )}
        <Field
          label="How the reward reads to customers"
          htmlFor="rewardLabel"
          error={errors.rewardLabel}
          hint="Used on the website and in emails: “12 stamps = a free all-over spray of your choice”."
        >
          <Input
            {...fieldAria("rewardLabel", errors.rewardLabel)}
            defaultValue={values.rewardLabel}
            maxLength={120}
            className="h-11"
          />
        </Field>
        <Check
          name="rewardItemsEarnStamps"
          defaultChecked={values.rewardItemsEarnStamps}
          label="Free reward items earn stamps too"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Check
            name="passportAuto"
            defaultChecked={passportAuto}
            onChange={setPassportAuto}
            label="Issue the passport automatically"
            hint="Otherwise only on request (Issue passport on the customer)."
          />
          {passportAuto ? (
            <Field
              label="After this many paid purchases"
              htmlFor="issuePassportAfterPurchases"
              error={errors.issuePassportAfterPurchases}
            >
              <Input
                {...fieldAria("issuePassportAfterPurchases", errors.issuePassportAfterPurchases)}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                defaultValue={values.issuePassportAfterPurchases ?? 2}
                className="h-11"
              />
            </Field>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Check
            name="expires"
            defaultChecked={expires}
            onChange={setExpires}
            label="Stamps expire"
            hint="Unused stamps older than this are written off, oldest first (checked whenever the card changes)."
          />
          {expires ? (
            <Field label="Expire after (months)" htmlFor="expiryMonths" error={errors.expiryMonths}>
              <Input
                {...fieldAria("expiryMonths", errors.expiryMonths)}
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                defaultValue={values.expiryMonths ?? 12}
                className="h-11"
              />
            </Field>
          ) : null}
        </div>
      </div>

      <Field
        label="Note for this change"
        htmlFor="note"
        error={errors.note}
        hint="Optional — shown in the rule history."
      >
        <Input {...fieldAria("note", errors.note)} maxLength={300} className="h-11" />
      </Field>

      <p className="text-muted-foreground text-sm">
        Rule changes apply from now on. Stamps and rewards customers already have are kept.
      </p>
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
