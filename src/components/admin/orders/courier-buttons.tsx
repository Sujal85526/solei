"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw, Truck } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Button } from "@/components/ui/button";
import { bookCourierAction, refreshTrackingAction } from "@/modules/fulfilments/actions";

export function BookCourierButton({ orderId }: { orderId: string }) {
  return (
    <ConfirmButton
      variant="default"
      title="Book the courier?"
      description="The order is marked dispatched and the customer is told it's on its way with the tracking number."
      confirmLabel="Book courier"
      action={() => bookCourierAction(orderId)}
    >
      <Truck /> Book courier
    </ConfirmButton>
  );
}

export function RefreshTrackingButton({
  orderId,
  fulfilmentId,
}: {
  orderId: string;
  fulfilmentId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshTrackingAction(orderId, fulfilmentId);
          if (r.ok) toast.success(r.message ?? "Updated.");
          else toast.error(r.error);
        })
      }
    >
      <RefreshCw /> {pending ? "Checking…" : "Refresh tracking"}
    </Button>
  );
}
