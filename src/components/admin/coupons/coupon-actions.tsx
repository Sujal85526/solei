"use client";

import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteCouponAction, setCouponActiveAction } from "@/modules/coupons/actions";

/** Pause / resume and delete, beside the coupon form. */
export function CouponActions({
  id,
  code,
  active,
  uses,
}: {
  id: string;
  code: string;
  active: boolean;
  uses: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmButton
        variant="outline"
        size="sm"
        title={active ? `Pause ${code}?` : `Make ${code} live again?`}
        description={
          active
            ? "Customers won't be able to use it until you make it live again."
            : "Customers can use it again (its dates and limits still apply)."
        }
        confirmLabel={active ? "Pause" : "Make live"}
        action={() => setCouponActiveAction(id, !active)}
      >
        {active ? "Pause" : "Make live"}
      </ConfirmButton>
      <ConfirmButton
        variant="ghost"
        size="sm"
        destructive
        title={`Delete ${code}?`}
        description={
          uses
            ? `It was used on ${uses} order${uses === 1 ? "" : "s"}; those orders keep the code on record. Pausing keeps it in this list instead.`
            : "It hasn't been used yet."
        }
        confirmLabel="Delete"
        action={() => deleteCouponAction(id)}
      >
        Delete
      </ConfirmButton>
    </div>
  );
}
