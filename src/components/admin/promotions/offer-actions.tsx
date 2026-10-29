"use client";

import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteOfferAction, setOfferActiveAction } from "@/modules/promotions/actions";

/** Pause / resume and delete, beside the offer form. */
export function OfferActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        variant="outline"
        size="sm"
        title={active ? `Pause “${name}”?` : `Make “${name}” live again?`}
        description={
          active
            ? "Prices go back to normal until you make it live again."
            : "It applies again automatically (its dates still apply)."
        }
        confirmLabel={active ? "Pause" : "Make live"}
        action={() => setOfferActiveAction(id, !active)}
      >
        {active ? "Pause" : "Make live"}
      </ConfirmButton>
      <ConfirmButton
        variant="ghost"
        size="sm"
        destructive
        title={`Delete “${name}”?`}
        description="Orders that already got it keep their prices. Pausing keeps it in this list instead."
        confirmLabel="Delete"
        action={() => deleteOfferAction(id)}
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
