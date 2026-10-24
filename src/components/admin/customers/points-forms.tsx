"use client";

import { useState } from "react";
import { Field } from "@/components/admin/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { adjustPointsAction, setCustomerBirthdayAction } from "@/modules/points/actions";
import { MONTHS } from "@/modules/points/schema";

export function PointsAdjustDialog({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(adjustPointsAction, null);
  const e = useActionToast(state, () => setOpen(false));
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Adjust points
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust points</DialogTitle>
            <DialogDescription>
              Add points, or take some off with a minus (e.g. -100). Logged with your name.
            </DialogDescription>
          </DialogHeader>
          <form {...action} className="grid gap-4" noValidate>
            <input type="hidden" name="customerId" value={customerId} />
            <Field label="Points" htmlFor="adjPoints" error={e.points} required>
              <Input id="adjPoints" name="points" inputMode="numeric" className="numeric h-11" />
            </Field>
            <Field label="Reason" htmlFor="adjPointsReason" error={e.reason} required>
              <Input
                id="adjPointsReason"
                name="reason"
                placeholder="e.g. Bought at a pop-up before points were on"
                className="h-11"
              />
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

export function BirthdayEditor({
  customerId,
  birthday,
}: {
  customerId: string;
  birthday: { month: number; day: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useFormAction(setCustomerBirthdayAction, null);
  const e = useActionToast(state, () => setOpen(false));
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }
  return (
    <form {...action} className="flex flex-wrap items-center gap-2" noValidate>
      <input type="hidden" name="customerId" value={customerId} />
      <NativeSelect name="day" aria-label="Day" defaultValue={birthday?.day ?? 0}>
        <option value={0}>Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect name="month" aria-label="Month" defaultValue={birthday?.month ?? 0}>
        <option value={0}>Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      {e.day ? <p className="text-destructive w-full text-xs">{e.day}</p> : null}
    </form>
  );
}
