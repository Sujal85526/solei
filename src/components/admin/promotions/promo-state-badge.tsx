import { Badge } from "@/components/ui/badge";
import { businessDay } from "@/lib/dates";

export type PromoState = "live" | "paused" | "scheduled" | "ended";

/** Live, paused, not started yet or over — from the switch and the business days. */
export function promoState(
  p: { active: boolean; startsOn: string | null; endsOn: string | null },
  today = businessDay(),
): PromoState {
  if (!p.active) return "paused";
  if (p.endsOn && p.endsOn < today) return "ended";
  if (p.startsOn && p.startsOn > today) return "scheduled";
  return "live";
}

const STATE_BADGE: Record<PromoState, { label: string; variant: "success" | "muted" | "outline" }> =
  {
    live: { label: "Live", variant: "success" },
    scheduled: { label: "Scheduled", variant: "outline" },
    paused: { label: "Paused", variant: "muted" },
    ended: { label: "Ended", variant: "muted" },
  };

export function PromoStateBadge({ state }: { state: PromoState }) {
  const s = STATE_BADGE[state];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
