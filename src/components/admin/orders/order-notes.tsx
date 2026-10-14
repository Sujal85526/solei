"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useFormAction } from "@/hooks/use-form-action";
import { updateNotesAction } from "@/modules/orders/actions";

/** Staff-only notes on an order (never shown to the customer). */
export function OrderNotes({
  orderId,
  notes,
  editable,
}: {
  orderId: string;
  notes: string | null;
  editable: boolean;
}) {
  const [state, action, pending] = useFormAction(updateNotesAction, null);
  const e = useActionToast(state);
  if (!editable)
    return (
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">{notes || "No notes."}</p>
    );
  return (
    <form {...action} className="flex flex-col gap-2" noValidate>
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="internalNotes" className="sr-only">
        Internal notes
      </label>
      <Textarea
        id="internalNotes"
        name="internalNotes"
        defaultValue={notes ?? ""}
        rows={3}
        placeholder="Gift wrap, call before delivery…"
        aria-invalid={e.internalNotes ? true : undefined}
      />
      {e.internalNotes ? <p className="text-destructive text-sm">{e.internalNotes}</p> : null}
      <Button type="submit" variant="outline" size="sm" className="self-end" disabled={pending}>
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </form>
  );
}
