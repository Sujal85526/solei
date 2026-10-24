import { Badge } from "@/components/ui/badge";
import { GIFT_CARD_STATE_LABELS, type GiftCardState } from "@/modules/gift-cards/schema";

const VARIANT: Record<GiftCardState, "success" | "muted" | "warning" | "outline"> = {
  active: "success",
  pending: "outline",
  used: "muted",
  expired: "warning",
  void: "muted",
};

export function GiftCardStateBadge({ state }: { state: GiftCardState }) {
  return <Badge variant={VARIANT[state]}>{GIFT_CARD_STATE_LABELS[state]}</Badge>;
}
