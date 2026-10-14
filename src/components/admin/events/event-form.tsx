"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { formatBusinessDate } from "@/lib/dates";
import { filsToAed } from "@/lib/money";
import { cn } from "@/lib/utils";
import { checkOverlapsAction, saveEventAction } from "@/modules/events/actions";
import type { Overlap } from "@/modules/events/queries";
import {
  applySameHours,
  emirateLabels,
  emirates,
  eventStatusLabels,
  eventStatuses,
  eventTypeLabels,
  eventTypes,
  feePaymentStatusLabels,
  feePaymentStatuses,
  generateDayRows,
  type DailyHours,
  type DayHoursRow,
} from "@/modules/events/schema";
import { formatEventDates } from "./event-card";
import { StatusBadge } from "./event-style";

export type EventFormValues = {
  id?: string;
  name?: string;
  type?: string;
  status?: string;
  organiser_name?: string | null;
  organiser_contact?: string | null;
  organiser_phone?: string | null;
  organiser_email?: string | null;
  location?: string | null;
  emirate?: string | null;
  start_date?: string;
  end_date?: string;
  daily_hours?: DailyHours;
  booth_details?: string | null;
  participation_fee_fils?: number;
  fee_payment_status?: string;
  notes?: string | null;
};

const DEFAULT_HOURS = { open: "10:00", close: "22:00" };

export function EventForm({
  event,
  defaultDate,
}: {
  event?: EventFormValues;
  defaultDate: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useFormAction(saveEventAction, null);
  const onSaved = useCallback(
    (data: { id: string }) => router.push(`/admin/calendar/events/${data.id}`),
    [router],
  );
  const e = useActionToast(state, onSaved);

  const [start, setStart] = useState(event?.start_date ?? defaultDate);
  const [end, setEnd] = useState(event?.end_date ?? defaultDate);
  const [location, setLocation] = useState(event?.location ?? "");
  const [rows, setRows] = useState<DayHoursRow[]>(() =>
    generateDayRows(start, end, event?.daily_hours ?? {}, event?.id ? undefined : DEFAULT_HOURS),
  );
  const [same, setSame] = useState(() => {
    const filled = rows.filter((r) => r.open || r.close);
    return filled.every((r) => r.open === filled[0]?.open && r.close === filled[0]?.close);
  });
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);

  // Regenerate day rows when the dates change, keeping what was typed.
  const changeDates = (s: string, en: string) => {
    setStart(s);
    setEnd(en);
    setRows((prev) => {
      const next = generateDayRows(s, en, prev);
      return same && prev[0] ? applySameHours(next, prev[0]) : next;
    });
  };

  // Overlap warning (debounced; never blocks saving).
  useEffect(() => {
    if (!start || !end || end < start) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkOverlapsAction({
        startDate: start,
        endDate: end,
        excludeId: event?.id,
        location: location || undefined,
      });
      if (!cancelled) setOverlaps(res);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [start, end, location, event?.id]);

  const updateRow = (day: string, patch: Partial<DayHoursRow>) =>
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, ...patch } : r)));
  const first = rows[0] ?? { day: start, ...DEFAULT_HOURS };

  return (
    <form {...action} className="flex flex-col gap-6" noValidate>
      {event?.id ? <input type="hidden" name="id" value={event.id} /> : null}
      <input type="hidden" name="dailyHours" value={JSON.stringify(end >= start ? rows : [])} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Event</legend>
        <Field label="Event name" htmlFor="name" error={e.name} required className="sm:col-span-2">
          <Input
            id="name"
            name="name"
            defaultValue={event?.name}
            placeholder="Abu Dhabi Art Fair"
            className="h-11"
            autoComplete="off"
          />
        </Field>
        <Field label="Type" htmlFor="type" error={e.type} required>
          <NativeSelect
            id="type"
            name="type"
            defaultValue={event?.type ?? "exhibition"}
            className="[&_select]:h-11"
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {eventTypeLabels[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Status" htmlFor="status" error={e.status} required>
          <NativeSelect
            id="status"
            name="status"
            defaultValue={event?.status ?? "potential"}
            className="[&_select]:h-11"
          >
            {eventStatuses.map((s) => (
              <option key={s} value={s}>
                {eventStatusLabels[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="First day" htmlFor="startDate" error={e.startDate} required>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={start}
            onChange={(ev) =>
              changeDates(ev.target.value, end < ev.target.value ? ev.target.value : end)
            }
            className="h-11"
          />
        </Field>
        <Field label="Last day" htmlFor="endDate" error={e.endDate} required>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            value={end}
            min={start}
            onChange={(ev) => changeDates(start, ev.target.value)}
            className="h-11"
          />
        </Field>
        <Field label="Venue / location" htmlFor="location" error={e.location}>
          <Input
            id="location"
            name="location"
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
            placeholder="ADNEC, Hall 3"
            className="h-11"
          />
        </Field>
        <Field label="Emirate" htmlFor="emirate" error={e.emirate}>
          <NativeSelect
            id="emirate"
            name="emirate"
            defaultValue={event?.emirate ?? ""}
            className="[&_select]:h-11"
          >
            <option value="">—</option>
            {emirates.map((em) => (
              <option key={em} value={em}>
                {emirateLabels[em]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </fieldset>

      {overlaps.length ? (
        <div
          role="status"
          data-testid="overlap-warning"
          className="flex gap-3 rounded-xl border border-[#B4690E]/40 bg-[#B4690E]/5 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#8A5108]" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-[#8A5108]">
              Clashes with {overlaps.length} other event{overlaps.length > 1 ? "s" : ""} on these
              dates
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              You can still save — this is only a warning.
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {overlaps.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    href={`/admin/calendar/events/${o.id}`}
                    target="_blank"
                    className="text-burgundy font-medium underline-offset-4 hover:underline"
                  >
                    {o.name}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {formatEventDates(o.start_date, o.end_date)}
                    {o.location ? ` · ${o.location}` : ""}
                  </span>
                  <StatusBadge status={o.status} className="h-5 px-2 text-[0.65rem]" />
                  {o.same_location ? (
                    <span className="rounded bg-[#B4690E]/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#8A5108]">
                      Same venue
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-foreground mb-1 text-sm font-semibold">Working hours</legend>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={same}
            onChange={(ev) => {
              setSame(ev.target.checked);
              if (ev.target.checked)
                setRows((prev) => applySameHours(prev, prev[0] ?? DEFAULT_HOURS));
            }}
            className="accent-burgundy size-5"
          />
          Same hours every day
        </label>
        {same ? (
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <Field label="Opens" htmlFor="sameOpen">
              <Input
                id="sameOpen"
                type="time"
                value={first.open}
                onChange={(ev) =>
                  setRows((p) => applySameHours(p, { open: ev.target.value, close: first.close }))
                }
                className="h-11"
              />
            </Field>
            <Field label="Closes" htmlFor="sameClose">
              <Input
                id="sameClose"
                type="time"
                value={first.close}
                onChange={(ev) =>
                  setRows((p) => applySameHours(p, { open: first.open, close: ev.target.value }))
                }
                className="h-11"
              />
            </Field>
          </div>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border" data-testid="day-hours">
            {rows.map((r) => (
              <li
                key={r.day}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2"
              >
                <span className="text-sm">
                  {formatBusinessDate(r.day, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <Input
                  type="time"
                  aria-label={`Opens ${r.day}`}
                  value={r.open}
                  onChange={(ev) => updateRow(r.day, { open: ev.target.value })}
                  className="h-10 w-28"
                />
                <Input
                  type="time"
                  aria-label={`Closes ${r.day}`}
                  value={r.close}
                  onChange={(ev) => updateRow(r.day, { close: ev.target.value })}
                  className="h-10 w-28"
                />
              </li>
            ))}
          </ul>
        )}
        {e.dailyHours ? <p className="text-destructive text-sm">{e.dailyHours}</p> : null}
        <p className="text-muted-foreground text-xs">
          {rows.length} day{rows.length === 1 ? "" : "s"}. Leave times empty for days without set
          hours; closing after midnight is fine.
        </p>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-3 text-sm font-semibold">Organiser</legend>
        <Field label="Organiser" htmlFor="organiserName" error={e.organiserName}>
          <Input
            id="organiserName"
            name="organiserName"
            defaultValue={event?.organiser_name ?? ""}
            className="h-11"
          />
        </Field>
        <Field label="Contact person" htmlFor="organiserContact" error={e.organiserContact}>
          <Input
            id="organiserContact"
            name="organiserContact"
            defaultValue={event?.organiser_contact ?? ""}
            className="h-11"
          />
        </Field>
        <Field label="Phone" htmlFor="organiserPhone" error={e.organiserPhone}>
          <Input
            id="organiserPhone"
            name="organiserPhone"
            type="tel"
            inputMode="tel"
            defaultValue={event?.organiser_phone ?? ""}
            placeholder="050 123 4567"
            className="h-11"
          />
        </Field>
        <Field label="Email" htmlFor="organiserEmail" error={e.organiserEmail}>
          <Input
            id="organiserEmail"
            name="organiserEmail"
            type="email"
            inputMode="email"
            defaultValue={event?.organiser_email ?? ""}
            className="h-11"
          />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-foreground mb-3 text-sm font-semibold">Booth & fee</legend>
        <Field label="Participation fee (AED)" htmlFor="feeAed" error={e.feeAed}>
          <Input
            id="feeAed"
            name="feeAed"
            inputMode="decimal"
            defaultValue={
              event?.participation_fee_fils ? String(filsToAed(event.participation_fee_fils)) : ""
            }
            placeholder="0"
            className="numeric h-11"
          />
        </Field>
        <Field label="Fee payment" htmlFor="feePaymentStatus" error={e.feePaymentStatus}>
          <NativeSelect
            id="feePaymentStatus"
            name="feePaymentStatus"
            defaultValue={event?.fee_payment_status ?? "not_applicable"}
            className="[&_select]:h-11"
          >
            {feePaymentStatuses.map((f) => (
              <option key={f} value={f}>
                {feePaymentStatusLabels[f]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Booth details"
          htmlFor="boothDetails"
          error={e.boothDetails}
          className="sm:col-span-2"
        >
          <Textarea
            id="boothDetails"
            name="boothDetails"
            defaultValue={event?.booth_details ?? ""}
            placeholder="Booth B12, 3×3 m, corner, power socket"
            rows={2}
          />
        </Field>
        <Field label="Notes" htmlFor="notes" error={e.notes} className="sm:col-span-2">
          <Textarea id="notes" name="notes" defaultValue={event?.notes ?? ""} rows={3} />
        </Field>
      </fieldset>

      <div
        className={cn(
          "bg-background/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2 border-t px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0",
        )}
      >
        <Button type="submit" size="lg" disabled={pending} className="flex-1 sm:flex-none">
          {pending ? "Saving…" : event?.id ? "Save changes" : "Create event"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          className="sm:flex-none"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
