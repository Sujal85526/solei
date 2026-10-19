import { Badge } from "@/components/ui/badge";
import type { CouponState } from "@/modules/coupons/schema";

const STATE_BADGE: Record<
  CouponState,
  { label: string; variant: "success" | "muted" | "warning" | "outline" }
> = {
  active: { label: "Live", variant: "success" },
  scheduled: { label: "Scheduled", variant: "outline" },
  paused: { label: "Paused", variant: "muted" },
  expired: { label: "Expired", variant: "muted" },
  used_up: { label: "Used up", variant: "warning" },
};

export function CouponStateBadge({ state }: { state: CouponState }) {
  const s = STATE_BADGE[state];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
