"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { deleteShiftAction, saveShiftAction } from "@/modules/attendance/actions";
import { isoToDubaiLocal, type Shift } from "@/modules/attendance/schema";

type Option = { id: string; name: string };

/** Owner: add a shift or correct one (forgotten clock-out, paper timesheet). Times in UAE time. */
export function ShiftDialog({
  shift,
  people,
  events,
}: {
  shift?: Shift;
  people: Option[];
  events: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(saveShiftAction, null);
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
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Add shift
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{shift ? "Edit shift" : "Add shift"}</DialogTitle>
          </DialogHeader>
          <form {...action} className="grid gap-4" noValidate>
            {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
            <Field label="Who" htmlFor="shiftUser" error={e.userId} required>
              <NativeSelect
                id="shiftUser"
                name="userId"
                defaultValue={shift?.userId ?? ""}
                className="[&_button]:h-11"
              >
                <option value="">Choose…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clock in" htmlFor="shiftIn" error={e.clockIn} required>
                <Input
                  id="shiftIn"
                  name="clockIn"
                  type="datetime-local"
                  defaultValue={shift ? isoToDubaiLocal(shift.clockIn) : ""}
                  className="h-11"
                />
              </Field>
              <Field
                label="Clock out"
                htmlFor="shiftOut"
                error={e.clockOut}
                hint="Empty = still working"
              >
                <Input
                  id="shiftOut"
                  name="clockOut"
                  type="datetime-local"
                  defaultValue={shift?.clockOut ? isoToDubaiLocal(shift.clockOut) : ""}
                  className="h-11"
                />
              </Field>
            </div>
            <Field label="Event" htmlFor="shiftEvent">
              <NativeSelect
                id="shiftEvent"
                name="eventId"
                defaultValue={shift?.eventId ?? ""}
                className="[&_button]:h-11"
              >
                <option value="">No event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Note" htmlFor="shiftNote" error={e.note}>
              <Input id="shiftNote" name="note" defaultValue={shift?.note ?? ""} className="h-11" />
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

export function DeleteShiftButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      variant="ghost"
      size="icon-sm"
      destructive
      aria-label="Remove shift"
      title="Remove this shift?"
      confirmLabel="Remove"
      action={() => deleteShiftAction(id)}
    >
      <Trash2 />
    </ConfirmButton>
  );
}
