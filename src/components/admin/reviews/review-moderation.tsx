"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { moderateReviewAction } from "@/modules/reviews/actions";
import type { ReviewStatus } from "@/modules/reviews/schema";

/** Approve / decline buttons on a review card (approved reviews can be hidden again). */
export function ReviewModeration({ id, status }: { id: string; status: ReviewStatus }) {
  const [pending, start] = useTransition();
  const run = (to: "approved" | "declined") =>
    start(async () => {
      const res = await moderateReviewAction(id, to);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  return (
    <div className="flex gap-2">
      {status !== "approved" ? (
        <Button size="sm" disabled={pending} onClick={() => run("approved")}>
          Approve
        </Button>
      ) : null}
      {status !== "declined" ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("declined")}>
          {status === "approved" ? "Hide" : "Decline"}
        </Button>
      ) : null}
    </div>
  );
}
