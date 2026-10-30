"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { AdminSection } from "@/components/admin/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import {
  deleteSegmentAction,
  previewSegmentAction,
  saveSegmentAction,
} from "@/modules/campaigns/actions";
import type { SegmentPreview } from "@/modules/campaigns/queries";
import { rulesToForm, type SegmentRules } from "@/modules/campaigns/schema";
import { customerLabels, labelNames } from "@/modules/customers/labels";
import { emirateLabels } from "@/modules/customers/schema";
import { emirates } from "@/modules/cart/schema";

type Recency = "any" | "within" | "not";

/** Build a segment from simple rules; the count and first customers update as you type. */
export function SegmentForm({
  segment,
  destinations,
}: {
  segment?: { id: string; name: string; description: string | null; rules: SegmentRules };
  destinations: { id: string; name: string }[];
}) {
  const v = rulesToForm(segment?.rules ?? {});
  const [state, action, pending] = useFormAction(saveSegmentAction, null);
  const e = useActionToast(state);
  const [recency, setRecency] = useState<Recency>(
    v.purchasedWithinDays ? "within" : v.notPurchasedDays ? "not" : "any",
  );
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const req = useRef(0);

  const refresh = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      if (!form.current) return;
      const id = ++req.current;
      const res = await previewSegmentAction(new FormData(form.current));
      if (id === req.current && res) setPreview(res);
    }, 350);
  }, []);
  useEffect(refresh, [refresh, recency]);

  const box = "flex items-center gap-2.5 text-sm";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <form ref={form} {...action} onChange={refresh} noValidate className="flex flex-col gap-6">
        {segment ? <input type="hidden" name="id" value={segment.id} /> : null}
        <AdminSection title="Segment">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={e.name} required>
              <Input
                id="name"
                name="name"
                defaultValue={segment?.name}
                placeholder="e.g. Big spenders"
                className="h-11"
              />
            </Field>
            <Field label="Note" htmlFor="description" error={e.description}>
              <Input
                id="description"
                name="description"
                defaultValue={segment?.description ?? ""}
                className="h-11"
              />
            </Field>
          </div>
        </AdminSection>

        <AdminSection title="Who's in it" description="All optional — leave empty for everyone.">
          <div className="flex flex-col gap-6">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Spent at least (AED)" htmlFor="minSpent" error={e.minSpent}>
                <Input
                  id="minSpent"
                  name="minSpent"
                  inputMode="decimal"
                  defaultValue={v.minSpent}
                  className="numeric h-11"
                />
              </Field>
              <Field label="Spent at most (AED)" htmlFor="maxSpent" error={e.maxSpent}>
                <Input
                  id="maxSpent"
                  name="maxSpent"
                  inputMode="decimal"
                  defaultValue={v.maxSpent}
                  className="numeric h-11"
                />
              </Field>
              <Field label="At least (orders)" htmlFor="minOrders" error={e.minOrders}>
                <Input
                  id="minOrders"
                  name="minOrders"
                  inputMode="numeric"
                  defaultValue={v.minOrders}
                  className="numeric h-11"
                />
              </Field>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-medium">Last purchase</legend>
              <label className={box}>
                <input
                  type="radio"
                  name="recency"
                  checked={recency === "any"}
                  onChange={() => setRecency("any")}
                  className="accent-primary"
                />
                Any time (or never)
              </label>
              <label className={box}>
                <input
                  type="radio"
                  name="recency"
                  checked={recency === "within"}
                  onChange={() => setRecency("within")}
                  className="accent-primary"
                />
                Bought in the last
                <Input
                  name={recency === "within" ? "purchasedWithinDays" : undefined}
                  inputMode="numeric"
                  defaultValue={v.purchasedWithinDays || "30"}
                  disabled={recency !== "within"}
                  aria-label="Days"
                  className="numeric h-9 w-20"
                />
                days
              </label>
              <label className={box}>
                <input
                  type="radio"
                  name="recency"
                  checked={recency === "not"}
                  onChange={() => setRecency("not")}
                  className="accent-primary"
                />
                Nothing in the last
                <Input
                  name={recency === "not" ? "notPurchasedDays" : undefined}
                  inputMode="numeric"
                  defaultValue={v.notPurchasedDays || "90"}
                  disabled={recency !== "not"}
                  aria-label="Days"
                  className="numeric h-9 w-20"
                />
                days
              </label>
              {e.purchasedWithinDays || e.notPurchasedDays ? (
                <p className="text-destructive text-xs">
                  {e.purchasedWithinDays ?? e.notPurchasedDays}
                </p>
              ) : null}
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Bought a scent from</legend>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                {destinations.map((d) => (
                  <label key={d.id} className={box}>
                    <input
                      type="checkbox"
                      name="destinationIds"
                      value={d.id}
                      defaultChecked={v.destinationIds.includes(d.id)}
                      className="accent-primary size-4"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Solei Passport" htmlFor="passport">
                <NativeSelect
                  id="passport"
                  name="passport"
                  defaultValue={v.passport}
                  className="[&_button]:h-11"
                >
                  <option value="">Any</option>
                  <option value="has">Has a passport</option>
                  <option value="none">No passport yet</option>
                  <option value="reward">Has a reward waiting</option>
                </NativeSelect>
              </Field>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Label</legend>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                {customerLabels.map((l) => (
                  <label key={l} className={box}>
                    <input
                      type="checkbox"
                      name="labels"
                      value={l}
                      defaultChecked={v.labels.includes(l)}
                      className="accent-primary size-4"
                    />
                    {labelNames[l]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Emirate</legend>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                {emirates.map((em) => (
                  <label key={em} className={box}>
                    <input
                      type="checkbox"
                      name="emirates"
                      value={em}
                      defaultChecked={v.emirates.includes(em)}
                      className="accent-primary size-4"
                    />
                    {emirateLabels[em]}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="consent"
                defaultChecked={v.consent}
                className="accent-primary mt-0.5 size-4"
              />
              <span>
                Only customers who agreed to marketing
                <span className="text-muted-foreground block text-xs">
                  Campaigns always go to email opt-ins only, whatever you choose here.
                </span>
              </span>
            </label>
          </div>
        </AdminSection>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : segment ? "Save segment" : "Create segment"}
          </Button>
          {segment ? (
            <ConfirmButton
              variant="ghost"
              destructive
              title={`Delete ${segment.name}?`}
              description="Campaigns already sent to it keep its name on record."
              confirmLabel="Delete"
              action={() => deleteSegmentAction(segment.id)}
            >
              Delete
            </ConfirmButton>
          ) : null}
        </div>
      </form>

      <AdminSection title="Customers" className="lg:sticky lg:top-6">
        {preview ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="numeric text-3xl font-semibold">{preview.total}</p>
              <p className="text-muted-foreground text-sm">
                match · <span className="text-foreground font-medium">{preview.emailable}</span> can
                get campaigns
              </p>
            </div>
            {preview.sample.length ? (
              <ul className="divide-y text-sm">
                {preview.sample.map((m) => (
                  <li key={m.customerId} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link
                        href={`/admin/customers/${m.customerId}`}
                        className="block truncate underline-offset-4 hover:underline"
                      >
                        {m.name || m.email || "—"}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {m.lastPurchaseAt
                          ? `last ${formatBusinessDate(m.lastPurchaseAt)}`
                          : "no purchase yet"}
                        {m.emailable ? "" : " · no email consent"}
                      </span>
                    </span>
                    <span className="numeric shrink-0">{formatAED(m.totalSpentFils)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Counting…</p>
        )}
      </AdminSection>
    </div>
  );
}
