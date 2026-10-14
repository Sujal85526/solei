"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { eventsCopy as c } from "@/content/events";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { cn } from "@/lib/utils";
import { previewEstimateAction, submitBookingAction } from "@/modules/bookings/actions";
import { draftStore, useDraft } from "@/modules/bookings/draft-store";
import { computeEstimate } from "@/modules/bookings/estimate";
import {
  emptyDraft,
  firstInvalidStep,
  validateStep,
  WIZARD_STEPS,
  type BookingDraft,
} from "@/modules/bookings/schema";
import type { BookingConfig, Estimate } from "@/modules/bookings/types";
import {
  BoothStep,
  ContactStep,
  DetailsStep,
  EventTypeStep,
  FlowersStep,
  PackageStep,
  ProductsStep,
  ServicesStep,
  type StepProps,
} from "./wizard-steps";

const w = c.wizard;
const TOTAL = WIZARD_STEPS.length;
const STEP_VIEWS = [
  EventTypeStep,
  DetailsStep,
  ServicesStep,
  PackageStep,
  BoothStep,
  FlowersStep,
  ProductsStep,
  ContactStep,
] as const;
const PACKAGE_STEP = WIZARD_STEPS.findIndex((s) => s.id === "package");

const productsOf = (d: BookingDraft) =>
  Object.entries(d.products)
    .map(([category, v]) => ({ category, qty: Number(v) || 0 }))
    .filter((p) => p.qty > 0);

/** The 9-step "Plan your event" wizard. Draft saved locally; estimate and submit are server-side. */
export function BookingWizard({ config }: { config: BookingConfig }) {
  const state = useDraft();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string } | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [, startPreview] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const step = state?.step ?? 0;
  const draft = state?.draft ?? emptyDraft;
  const stepId = WIZARD_STEPS[step].id;

  // Move focus to the new step's heading after navigation (not on first render).
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus();
  }, [step, done]);

  // Summary: ask the server for the authoritative estimate.
  const previewKey = JSON.stringify([
    draft.packageId,
    draft.flowers,
    draft.flowerOptionId,
    draft.products,
  ]);
  useEffect(() => {
    if (stepId !== "summary") return;
    startPreview(async () => {
      const r = await previewEstimateAction({
        packageId: draft.packageId,
        flowers: draft.flowers,
        flowerOptionId: draft.flowerOptionId,
        products: draft.products,
      });
      setEstimate(r.ok ? r.data : null);
      if (!r.ok) setFormError(r.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, previewKey]);

  const running = useMemo(
    () =>
      computeEstimate(
        {
          packageId: draft.packageId,
          flowers: draft.flowers,
          flowerOptionId: draft.flowerOptionId,
          productsInterest: productsOf(draft),
        },
        config,
      ),
    [draft, config],
  );

  if (!state) {
    return <div className="min-h-[28rem]" aria-busy="true" />;
  }

  const update = (patch: Partial<BookingDraft>) => {
    draftStore.update(patch);
    if (Object.keys(errors).length) {
      const next = { ...errors };
      for (const k of Object.keys(patch)) delete next[k];
      if (patch.products)
        for (const k of Object.keys(next)) if (k.startsWith("products.")) delete next[k];
      setErrors(next);
    }
  };

  function go(next: number) {
    moved.current = true;
    setErrors({});
    setFormError(null);
    draftStore.setStep(next);
  }

  function focusFirstError(errs: Record<string, string>) {
    requestAnimationFrame(() => {
      const key = Object.keys(errs)[0];
      const el =
        document.getElementById(key) ??
        document.querySelector<HTMLElement>(`[data-first="${key}"]`) ??
        document.querySelector<HTMLElement>(`[data-field="${key}"] input`);
      el?.focus();
    });
  }

  function next() {
    const errs = validateStep(step, draft);
    if (errs) {
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    go(Math.min(step + 1, TOTAL - 1));
  }

  function submit() {
    const bad = firstInvalidStep(draft);
    if (bad >= 0 && bad < TOTAL - 1) {
      go(bad);
      const errs = validateStep(bad, draft) ?? {};
      setErrors(errs);
      return;
    }
    startSubmit(async () => {
      const clientUuid = draftStore.ensureClientUuid();
      const r = await submitBookingAction({ ...draft, clientUuid });
      if (r.ok) {
        moved.current = true;
        draftStore.reset();
        setDone({ ref: r.data.ref });
        return;
      }
      setFormError(r.error);
      if (r.fieldErrors) {
        const bad2 = firstInvalidStep(draft);
        if (bad2 >= 0) {
          go(bad2);
          setErrors(r.fieldErrors);
        }
      }
    });
  }

  if (done) {
    return (
      <div className="on-blush px-6 py-16 text-center sm:px-14 sm:py-24" role="status">
        <p className="eyebrow text-burgundy/70">{w.done.eyebrow}</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="display mt-5 text-5xl outline-none sm:text-6xl"
        >
          {w.done.title}
        </h2>
        <p className="text-ink/80 mx-auto mt-6 max-w-md leading-relaxed">{w.done.lede(done.ref)}</p>
        <p className="mt-8">
          <span className="eyebrow text-burgundy/70 block">{w.done.ref}</span>
          <span className="font-display text-burgundy numeric mt-2 block text-4xl">{done.ref}</span>
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              moved.current = true;
              setDone(null);
            }}
            className="border-burgundy/40 text-burgundy hover:border-burgundy inline-flex h-12 items-center border px-7 text-[0.65rem] tracking-[0.3em] uppercase"
          >
            {w.done.another}
          </button>
          <Link
            href="/shop"
            className="bg-burgundy text-pink inline-flex h-12 items-center px-7 text-[0.65rem] tracking-[0.3em] uppercase"
          >
            {w.done.shop}
          </Link>
        </div>
      </div>
    );
  }

  const meta = w.steps[stepId];
  const StepView = STEP_VIEWS[step] as ((p: StepProps) => React.ReactNode) | undefined;
  const showRunning = step >= PACKAGE_STEP && step < TOTAL - 1 && running.totalFils > 0;
  const restored = JSON.stringify(draft) !== JSON.stringify(emptyDraft);

  return (
    <div className="flex flex-col gap-8">
      {/* Progress */}
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="eyebrow text-pink/80">
            {w.stepOf(step + 1, TOTAL)} · {WIZARD_STEPS[step].title}
          </p>
          {restored ? (
            <button
              type="button"
              onClick={() => {
                draftStore.reset();
                go(0);
              }}
              className="text-pearl-muted hover:text-pink text-xs underline underline-offset-4"
            >
              {w.startOver}
            </button>
          ) : null}
        </div>
        <ol className="mt-4 grid grid-cols-9 gap-1" aria-label="Progress">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.id}>
              {i < step ? (
                <button
                  type="button"
                  onClick={() => go(i)}
                  className="group block w-full py-2"
                  aria-label={`Step ${i + 1}: ${s.title} (completed) — edit`}
                >
                  <span className="bg-pink block h-0.5 w-full" />
                  <span className="text-pearl-muted group-hover:text-pink mt-2 hidden truncate text-[0.6rem] tracking-[0.15em] uppercase lg:block">
                    {s.title}
                  </span>
                </button>
              ) : (
                <span
                  className="block py-2"
                  aria-current={i === step ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                >
                  <span
                    className={cn("block h-0.5 w-full", i === step ? "bg-pink/70" : "bg-pink/15")}
                  />
                  <span
                    className={cn(
                      "mt-2 hidden truncate text-[0.6rem] tracking-[0.15em] uppercase lg:block",
                      i === step ? "text-pink" : "text-pearl-muted/60",
                    )}
                  >
                    {s.title}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="sr-only" aria-live="polite">
          {`${w.stepOf(step + 1, TOTAL)}: ${meta.title}`}
        </p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (stepId === "summary") submit();
          else next();
        }}
        className="flex flex-col gap-8"
      >
        <fieldset className="flex flex-col gap-6" aria-labelledby="wizard-step-title">
          <div>
            <h3
              id="wizard-step-title"
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-pink text-3xl outline-none sm:text-4xl"
            >
              {meta.title}
            </h3>
            <p className="text-pearl-muted mt-2 text-sm">{meta.hint}</p>
          </div>

          {StepView ? (
            <StepView draft={draft} errors={errors} update={update} config={config} />
          ) : (
            <Summary draft={draft} config={config} estimate={estimate} onEdit={go} />
          )}
        </fieldset>

        {showRunning ? (
          <p className="text-pearl-muted border-pink/15 flex items-baseline justify-between border-t pt-4 text-sm">
            {w.estimateSoFar}
            <span className="numeric font-display text-pink text-2xl">
              {formatAED(running.totalFils)}
            </span>
          </p>
        ) : null}

        {formError ? (
          <p role="alert" className="text-destructive text-sm">
            {formError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="text-pearl hover:text-pink inline-flex h-12 items-center gap-2 px-2 text-[0.65rem] tracking-[0.3em] uppercase"
            >
              <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.25} />
              {w.back}
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={submitting}
            className="group bg-pink text-burgundy hover:bg-pearl inline-flex h-12 items-center gap-4 px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors disabled:opacity-60"
          >
            {stepId === "summary" ? (submitting ? w.submitting : w.submit) : w.next}
            {stepId === "summary" ? (
              <Check className="size-3.5" strokeWidth={1.5} />
            ) : (
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                strokeWidth={1.25}
              />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Summary({
  draft,
  config,
  estimate,
  onEdit,
}: {
  draft: BookingDraft;
  config: BookingConfig;
  estimate: Estimate | null;
  onEdit: (step: number) => void;
}) {
  const s = w.summary;
  const name = <T extends { id: string; name: string }>(list: T[], id: string) =>
    list.find((x) => x.id === id)?.name;
  const stepOf = (id: string) => WIZARD_STEPS.findIndex((x) => x.id === id);
  const flower = config.flowers.find((f) => f.id === draft.flowerOptionId);
  const products = productsOf(draft)
    .map(
      (p) =>
        `${config.products.find((x) => x.category === p.category)?.name ?? p.category} × ${p.qty}`,
    )
    .join(", ");

  const rows: [string, string, string][] = [
    [s.occasion, name(config.eventTypes, draft.eventTypeId) ?? s.none, "type"],
    [
      s.when,
      draft.eventDate
        ? `${formatBusinessDate(draft.eventDate, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}, ${draft.startTime}–${draft.endTime}`
        : s.none,
      "details",
    ],
    [
      s.where,
      [draft.location, c.emirates[draft.emirate]].filter(Boolean).join(", ") || s.none,
      "details",
    ],
    [s.guests, draft.guests || s.none, "details"],
    [
      s.services,
      draft.serviceTypeIds
        .map((id) => name(config.services, id))
        .filter(Boolean)
        .join(", ") || s.none,
      "services",
    ],
    [s.package, name(config.packages, draft.packageId) ?? w.steps.package.undecided, "package"],
    [s.booth, name(config.booths, draft.boothDesignId) ?? w.steps.booth.none, "booth"],
    [s.flowers, draft.flowers && flower ? flower.name : w.steps.flowers.none, "flowers"],
    [s.products, products || s.none, "products"],
    [
      s.contact,
      [draft.name, draft.phone, draft.email].filter(Boolean).join(" · ") || s.none,
      "contact",
    ],
    [s.requests, draft.specialRequests || s.none, "contact"],
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <dl className="divide-pink/10 border-pink/15 divide-y border-y lg:col-span-7">
        {rows.map(([label, value, id], i) => (
          <div key={`${label}-${i}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
            <dt className="eyebrow text-pearl-muted w-32 shrink-0">{label}</dt>
            <dd className="text-pearl min-w-0 flex-1 text-sm break-words">{value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(stepOf(id))}
                className="text-pink text-xs underline underline-offset-4"
              >
                {w.edit}
                <span className="sr-only"> {label}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <div className="on-blush self-start p-6 sm:p-8 lg:col-span-5" aria-live="polite">
        <p className="eyebrow text-burgundy/70">{s.estimate}</p>
        {estimate ? (
          <>
            <ul className="mt-5 flex flex-col gap-3 text-sm">
              {estimate.lines.map((l, i) => (
                <li key={`${l.label}-${i}`} className="flex justify-between gap-4">
                  <span>
                    {l.label}
                    {l.kind === "products" ? ` × ${l.qty}` : ""}
                  </span>
                  <span className="numeric shrink-0">
                    {l.totalFils === null ? s.quotedLater : formatAED(l.totalFils)}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="border-burgundy/20 mt-5 flex items-baseline justify-between border-t pt-5"
              data-testid="estimate-total"
            >
              <span className="eyebrow">{s.estimate}</span>
              <span className="font-display numeric text-burgundy text-4xl">
                {formatAED(estimate.totalFils)}
              </span>
            </p>
          </>
        ) : (
          <p className="mt-5 text-sm">{s.calculating}</p>
        )}
        <p className="text-ink/70 mt-5 text-xs leading-relaxed">{s.estimateNote}</p>
      </div>
    </div>
  );
}
