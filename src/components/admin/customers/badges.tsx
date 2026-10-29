import { Badge } from "@/components/ui/badge";
import { isCustomerLabel, labelBadgeVariant, labelNames } from "@/modules/customers/labels";
import { channelLabel, consentState } from "@/modules/customers/schema";

export function ConsentBadge({
  customer,
  withChannels,
}: {
  customer: {
    marketing_consent: boolean | null;
    unsubscribed_at: string | null;
    marketing_channels?: string[] | null;
  };
  withChannels?: boolean;
}) {
  const state = consentState(customer);
  if (state === "opted_in") {
    const channels = (customer.marketing_channels ?? []).map(channelLabel).join(", ");
    return (
      <Badge variant="success">Opted in{withChannels && channels ? ` · ${channels}` : ""}</Badge>
    );
  }
  if (state === "unsubscribed") return <Badge variant="warning">Unsubscribed</Badge>;
  return <Badge variant="muted">No consent</Badge>;
}

/** Automatic label (New / Returning / VIP / Inactive); nothing for customers without one. */
export function LabelBadge({ label }: { label: string | null | undefined }) {
  if (!isCustomerLabel(label)) return null;
  return <Badge variant={labelBadgeVariant[label]}>{labelNames[label]}</Badge>;
}
