"use client";

import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteBannerAction, setBannerActiveAction } from "@/modules/promotions/actions";

/** Hide / show and delete, beside the banner form. */
export function BannerActions({ id, active }: { id: string; active: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        variant="outline"
        size="sm"
        title={active ? "Hide this banner?" : "Show this banner again?"}
        description={
          active
            ? "It disappears from the website until you show it again."
            : "It shows on the website again (its dates still apply)."
        }
        confirmLabel={active ? "Hide" : "Show"}
        action={() => setBannerActiveAction(id, !active)}
      >
        {active ? "Hide" : "Show again"}
      </ConfirmButton>
      <ConfirmButton
        variant="ghost"
        size="sm"
        destructive
        title="Delete this banner?"
        description="It and its image are removed. Hiding keeps it in this list instead."
        confirmLabel="Delete"
        action={() => deleteBannerAction(id)}
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
