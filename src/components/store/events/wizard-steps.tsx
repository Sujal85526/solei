"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { eventsCopy as c } from "@/content/events";
import { Constants } from "@/lib/database.types";
import { businessDay } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import type { BookingDraft } from "@/modules/bookings/schema";
import type { BookingConfig } from "@/modules/bookings/types";
import { cn } from "@/lib/utils";
import { PackageCompare } from "./package-compare";

export type StepProps = {
  draft: BookingDraft;
  errors: Record<string, string>;
  update: (patch: Partial<BookingDraft>) => void;
  config: BookingConfig;
};

const inputCls = "h-12 bg-noir text-base";
const w = c.wizard;

/** A visually rich radio/checkbox option. The real input stays in the a11y tree. */
function Choice({
  type,
  name,
  checked,
  onChange,
  title,
  hint,
  media,
  aside,
  first,
  describedBy,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  hint?: ReactNode;
  media?: ReactNode;
  aside?: ReactNode;
  first?: boolean;
  describedBy?: string;
}) {
  return (
    <label
      className={cn(
        "group border-pink/20 hover:border-pink/50 relative flex cursor-pointer flex-col overflow-hidden border transition-colors",
        "has-[:checked]:border-pink has-[:checked]:bg-pink/[0.07] has-[:focus-visible]:outline-pink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
        data-first={first ? name : undefined}
        aria-describedby={describedBy}
      />
      {media}
      <span className="flex items-start gap-4 p-4 sm:p-5">
        <span
          aria-hidden
          className={cn(
            "border-pink/50 mt-0.5 flex size-5 shrink-0 items-center justify-center border",
            type === "radio" && "rounded-full",
            checked && "bg-pink border-pink",
          )}
        >
          {checked ? <Check className="text-burgundy size-3.5" strokeWidth={2.5} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-pearl text-[0.95rem]">{title}</span>
          {hint ? <span className="text-pearl-muted text-sm leading-relaxed">{hint}</span> : null}
        </span>
        {aside ? <span className="numeric text-pink shrink-0 text-sm">{aside}</span> : null}
      </span>
    </label>
  );
}

function GroupError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="text-destructive mt-3 text-sm">
      {error}
    </p>
  ) : null;
}

export function EventTypeStep({ draft, errors, update, config }: StepProps) {
  return (
    <div data-field="eventTypeId">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.eventTypes.map((t, i) => (
          <Choice
            key={t.id}
            type="radio"
            name="eventTypeId"
            first={i === 0}
            checked={draft.eventTypeId === t.id}
            onChange={() => update({ eventTypeId: t.id })}
            title={t.name}
            describedBy={errors.eventTypeId ? "eventTypeId-error" : undefined}
          />
        ))}
      </div>
      <GroupError id="eventTypeId" error={errors.eventTypeId} />
    </div>
  );
}

export function DetailsStep({ draft, errors, update }: StepProps) {
  const aria = (id: keyof BookingDraft) => ({
    id,
    name: id,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={w.fields.date} htmlFor="eventDate" error={errors.eventDate} required>
        <Input
          {...aria("eventDate")}
          type="date"
          min={businessDay()}
          value={draft.eventDate}
          onChange={(e) => update({ eventDate: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label={w.fields.guests} htmlFor="guests" error={errors.guests} required>
        <Input
          {...aria("guests")}
          type="number"
          inputMode="numeric"
          min={1}
          max={10000}
          value={draft.guests}
          onChange={(e) => update({ guests: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label={w.fields.start} htmlFor="startTime" error={errors.startTime} required>
        <Input
          {...aria("startTime")}
          type="time"
          value={draft.startTime}
          onChange={(e) => update({ startTime: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field
        label={w.fields.end}
        htmlFor="endTime"
        error={errors.endTime}
        hint={w.fields.endHint}
        required
      >
        <Input
          {...aria("endTime")}
          type="time"
          value={draft.endTime}
          onChange={(e) => update({ endTime: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field
        label={w.fields.location}
        htmlFor="location"
        error={errors.location}
        required
        className="sm:col-span-2"
      >
        <Input
          {...aria("location")}
          autoComplete="off"
          placeholder={w.fields.locationPlaceholder}
          value={draft.location}
          onChange={(e) => update({ location: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label={w.fields.emirate} htmlFor="emirate" error={errors.emirate} required>
        <NativeSelect
          {...aria("emirate")}
          value={draft.emirate}
          onChange={(e) => update({ emirate: e.target.value })}
          className="[&_select]:bg-burgundy-deep [&_select]:h-12 [&_select]:text-base"
        >
          <option value="">{w.fields.chooseEmirate}</option>
          {Constants.public.Enums.emirate.map((e) => (
            <option key={e} value={e}>
              {c.emirates[e]}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

function Photo({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;
  return (
    <span className="relative block aspect-[4/3] overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 90vw"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
    </span>
  );
}

export function PackageStep({ draft, update, config }: StepProps) {
  const [compare, setCompare] = useState(false);
  return (
    <div data-field="packageId" className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.packages.map((p, i) => (
          <Choice
            key={p.id}
            type="radio"
            name="packageId"
            first={i === 0}
            checked={draft.packageId === p.id}
            onChange={() => update({ packageId: p.id })}
            media={<Photo src={p.images[0]} alt={`The ${p.name} package`} />}
            title={<span className="font-display text-pink text-2xl">{p.name}</span>}
            hint={
              <>
                {p.description}
                <span className="mt-2 block">{p.inclusions.join(" · ")}</span>
              </>
            }
            aside={formatAED(p.basePriceFils)}
          />
        ))}
        <Choice
          type="radio"
          name="packageId"
          checked={draft.packageId === ""}
          onChange={() => update({ packageId: "" })}
          title={w.steps.package.undecided}
          hint={w.steps.package.undecidedHint}
        />
      </div>
      {config.packages.length > 1 ? (
        <div>
          <button
            type="button"
            aria-expanded={compare}
            onClick={() => setCompare((v) => !v)}
            className="text-pink eyebrow underline underline-offset-4"
          >
            {compare ? c.packages.hideCompare : c.packages.compare}
          </button>
          {compare ? (
            <div className="mt-4">
              <PackageCompare packages={config.packages} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BoothStep({ draft, update, config }: StepProps) {
  return (
    <div data-field="boothDesignId" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {config.booths.map((b, i) => (
        <Choice
          key={b.id}
          type="radio"
          name="boothDesignId"
          first={i === 0}
          checked={draft.boothDesignId === b.id}
          onChange={() => update({ boothDesignId: b.id })}
          media={<Photo src={b.photos[0]} alt={`${b.name} booth design`} />}
          title={b.name}
          hint={b.description}
        />
      ))}
      <Choice
        type="radio"
        name="boothDesignId"
        checked={draft.boothDesignId === ""}
        onChange={() => update({ boothDesignId: "" })}
        title={w.steps.booth.none}
        hint={w.steps.booth.noneHint}
      />
    </div>
  );
}

export function FlowersStep({ draft, errors, update, config }: StepProps) {
  const s = w.steps.flowers;
  const cheapest = Math.min(...config.flowers.map((f) => f.priceFils), 0);
  return (
    <div className="flex flex-col gap-8">
      <div data-field="flowers" className="grid gap-3 sm:grid-cols-2">
        <Choice
          type="radio"
          name="flowers"
          first
          checked={!draft.flowers}
          onChange={() => update({ flowers: false })}
          title={s.none}
          hint={s.noneHint}
        />
        <Choice
          type="radio"
          name="flowers"
          checked={draft.flowers}
          onChange={() => update({ flowers: true })}
          title={s.add}
          hint={s.addHint(formatAED(config.flowerBaseFils + cheapest))}
        />
      </div>
      {draft.flowers ? (
        <fieldset data-field="flowerOptionId" className="min-w-0">
          <legend className="eyebrow text-pink/70 mb-4">{s.colour}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {config.flowers.map((f, i) => (
              <Choice
                key={f.id}
                type="radio"
                name="flowerOptionId"
                first={i === 0}
                checked={draft.flowerOptionId === f.id}
                onChange={() => update({ flowerOptionId: f.id })}
                title={
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="border-pearl/30 size-6 rounded-full border"
                      style={{ backgroundColor: f.hex }}
                    />
                    {f.name}
                  </span>
                }
                aside={formatAED(config.flowerBaseFils + f.priceFils)}
                describedBy={errors.flowerOptionId ? "flowerOptionId-error" : undefined}
              />
            ))}
          </div>
          <GroupError id="flowerOptionId" error={errors.flowerOptionId} />
        </fieldset>
      ) : null}
    </div>
  );
}

export function ContactStep({ draft, errors, update }: StepProps) {
  const f = w.fields;
  const aria = (id: keyof BookingDraft) => ({
    id,
    name: id,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
  });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={f.name} htmlFor="name" error={errors.name} required className="sm:col-span-2">
        <Input
          {...aria("name")}
          autoComplete="name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label={f.phone} htmlFor="phone" error={errors.phone} hint={f.phoneHint} required>
        <Input
          {...aria("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="050 123 4567"
          value={draft.phone}
          onChange={(e) => update({ phone: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label={f.email} htmlFor="email" error={errors.email} required>
        <Input
          {...aria("email")}
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(e) => update({ email: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field
        label={f.requests}
        htmlFor="specialRequests"
        error={errors.specialRequests}
        className="sm:col-span-2"
      >
        <Textarea
          {...aria("specialRequests")}
          rows={4}
          placeholder={f.requestsPlaceholder}
          value={draft.specialRequests}
          onChange={(e) => update({ specialRequests: e.target.value })}
          className="bg-burgundy-deep text-base"
        />
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2" data-field="consent">
        <label className="text-pearl/90 flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            id="consent"
            name="consent"
            checked={draft.consent}
            onChange={(e) => update({ consent: e.target.checked })}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="accent-pink mt-0.5 size-5 shrink-0"
          />
          <span>
            {f.consent} <span className="text-destructive">*</span>
          </span>
        </label>
        <GroupError id="consent" error={errors.consent} />
        <label className="text-pearl/80 flex items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={draft.marketingConsent}
            onChange={(e) => update({ marketingConsent: e.target.checked })}
            className="accent-pink mt-0.5 size-5 shrink-0"
          />
          {f.marketing}
        </label>
      </div>
    </div>
  );
}

/** Step 2 (the owner's flow): the event, then who we send the quotation to. */
export function EventDetailsStep(props: StepProps) {
  return (
    <div className="flex flex-col gap-10">
      <DetailsStep {...props} />
      <div className="border-pink/15 flex flex-col gap-5 border-t pt-8">
        <div>
          <h4 className="font-display text-pink text-2xl">{w.steps.contact.title}</h4>
          <p className="text-pearl-muted mt-1 text-sm">{w.steps.contact.hint}</p>
        </div>
        <ContactStep {...props} />
      </div>
    </div>
  );
}
