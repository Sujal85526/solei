import { Badge } from "@/components/ui/badge";
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
