"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import {
  copyRotaWeekAction,
  deleteRotaShiftAction,
  saveRotaShiftAction,
} from "@/modules/rota/actions";
import { localTime, shiftDay, type PlannedShift } from "@/modules/rota/schema";

type Option = { id: string; name: string };

/** Owner: plan a shift (or change one). Times in UAE time; an end before the start = next day. */
export function RotaShiftDialog({
  shift,
  day,
  people,
  events,
}: {
  shift?: PlannedShift;
  day?: string;
  people: Option[];
  events: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveRotaShiftAction, null);
  const e = useActionToast(state, () => setOpen(false));
  return (
    <>
      {shift ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit shift"
          onClick={() => setOpen(true)}
        >
          <Pencil />
        </Button>
      ) : day ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Plan a shift this day"
          onClick={() => setOpen(true)}
        >
          <Plus />
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Plan shift
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{shift ? "Edit shift" : "Plan a shift"}</DialogTitle>
          </DialogHeader>
          <form {...action} className="grid gap-4" noValidate>
            {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
            <Field label="Who" htmlFor="rotaUser" error={e.userId} required>
              <NativeSelect
                id="rotaUser"
                name="userId"
                defaultValue={shift?.userId ?? ""}
                className="[&_select]:h-11"
              >
                <option value="">Choose…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Day" htmlFor="rotaDay" error={e.day} required>
              <Input
                id="rotaDay"
                name="day"
                type="date"
                defaultValue={shift ? shiftDay(shift.startsAt) : (day ?? "")}
                className="h-11"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="From" htmlFor="rotaStart" error={e.start} required>
                <Input
                  id="rotaStart"
                  name="start"
                  type="time"
                  defaultValue={shift ? localTime(shift.startsAt) : "10:00"}
                  className="h-11"
                />
              </Field>
              <Field label="To" htmlFor="rotaEnd" error={e.end} required>
                <Input
                  id="rotaEnd"
                  name="end"
                  type="time"
                  defaultValue={shift ? localTime(shift.endsAt) : "18:00"}
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="Event" htmlFor="rotaEvent">
              <NativeSelect
                id="rotaEvent"
                name="eventId"
                defaultValue={shift?.eventId ?? ""}
                className="[&_select]:h-11"
              >
                <option value="">No event (shop, office…)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Note"
              htmlFor="rotaNote"
              error={e.note}
              hint="e.g. Booth lead, bring testers"
            >
              <Input id="rotaNote" name="note" defaultValue={shift?.note ?? ""} className="h-11" />
            </Field>
            <DialogFooter>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteRotaShiftButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      variant="ghost"
      size="icon-sm"
      destructive
      aria-label="Remove shift"
      title="Remove this planned shift?"
      confirmLabel="Remove"
      action={() => deleteRotaShiftAction(id)}
    >
      <Trash2 />
    </ConfirmButton>
  );
}

export function CopyWeekButton({ from, to }: { from: string; to: string }) {
  return (
    <ConfirmButton
      title="Copy last week's rota?"
      description="Every shift planned last week is added to this week, same days and times (without the events)."
      confirmLabel="Copy"
      action={() => copyRotaWeekAction(from, to)}
    >
      <Copy /> Copy last week
    </ConfirmButton>
  );
}
