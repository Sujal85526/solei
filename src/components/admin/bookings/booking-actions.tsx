"use client";

import { useCallback, useState } from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import {
  changeStatusAction,
  confirmBookingAction,
  setStatusAction,
} from "@/modules/bookings/actions";
import type { BookingStatus } from "@/modules/bookings/types";

const CLOSED: BookingStatus[] = ["completed", "rejected", "cancelled"];

/** Review / reject / cancel / confirm / complete — only the moves the database allows. */
export function BookingStatusActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [reasonFor, setReasonFor] = useState<"rejected" | "cancelled" | null>(null);
  const close = useCallback(() => setReasonFor(null), []);
  const closed = CLOSED.includes(status);
  return (
    <>
      {status === "requested" ? (
        <ConfirmButton
          title="Mark as in review?"
          description="Shows the team you're working on it."
          confirmLabel="Mark in review"
          action={setStatusAction.bind(null, bookingId, "in_review")}
        >
          Mark in review
        </ConfirmButton>
      ) : null}
      {["requested", "in_review", "quoted", "accepted"].includes(status) ? (
        <ConfirmButton
          variant="default"
          title="Confirm this booking?"
          description="Use this when the deposit was paid another way (e.g. bank transfer) or no deposit is needed. A private event is added to the calendar."
          confirmLabel="Confirm booking"
          action={confirmBookingAction.bind(null, bookingId)}
        >
          Confirm manually
        </ConfirmButton>
      ) : null}
      {status === "confirmed" ? (
        <ConfirmButton
          title="Mark as completed?"
          description="The event has taken place."
          confirmLabel="Mark completed"
          action={setStatusAction.bind(null, bookingId, "completed")}
        >
          Mark completed
        </ConfirmButton>
      ) : null}
      {!closed && status !== "confirmed" ? (
        <Button variant="outline" onClick={() => setReasonFor("rejected")}>
          Reject
        </Button>
      ) : null}
      {!closed ? (
        <Button variant="ghost" onClick={() => setReasonFor("cancelled")}>
          Cancel booking
        </Button>
      ) : null}
      {reasonFor ? <ReasonDialog bookingId={bookingId} status={reasonFor} onClose={close} /> : null}
    </>
  );
}

function ReasonDialog({
  bookingId,
  status,
  onClose,
}: {
  bookingId: string;
  status: "rejected" | "cancelled";
  onClose: () => void;
}) {
  const [state, form, pending] = useFormAction(changeStatusAction, null);
  const e = useActionToast(state, onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status === "rejected" ? "Reject request" : "Cancel booking"}</DialogTitle>
          <DialogDescription>
            {status === "rejected"
              ? "Open quotations are withdrawn. Let the customer know from the messages panel."
              : "Open quotations are withdrawn and the calendar event is cancelled. Refunds are recorded on the payment order."}
          </DialogDescription>
        </DialogHeader>
        <form {...form} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value={status} />
          <Field label="Reason" htmlFor="reason" error={e.reason} required>
            <Textarea id="reason" name="reason" rows={3} placeholder="e.g. Date fully booked" />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {status === "rejected" ? "Reject" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
