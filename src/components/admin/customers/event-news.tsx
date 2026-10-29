"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCustomerEventNewsAction } from "@/modules/automation/actions";

/** Staff add a customer to (or take them off) the event news list, e.g. when asked at a pop-up. */
export function EventNewsButton({ id, on }: { id: string; on: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setCustomerEventNewsAction(id, !on);
          if (res.ok) toast.success(res.message ?? "Saved.");
          else toast.error(res.error);
        })
      }
    >
      {on ? "Stop event news" : "Add to event news"}
    </Button>
  );
}
