import { Badge } from "@/components/ui/badge";
import {
  channelLabel,
  channelLabels,
  consentState,
  orderStatusLabels,
  paymentStatusLabels,
  type OrderChannel,
  type OrderStatus,
} from "@/modules/customers/schema";

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

export function ChannelBadge({ channel }: { channel: OrderChannel }) {
  return (
    <Badge variant={channel === "pos" ? "pink" : channel === "website" ? "secondary" : "outline"}>
      {channelLabels[channel]}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const variant =
    status === "cancelled"
      ? "destructive"
      : status === "completed" || status === "delivered"
        ? "success"
        : status === "pending_payment"
          ? "muted"
          : "secondary";
  return <Badge variant={variant}>{orderStatusLabels[status]}</Badge>;
}

export function PaymentBadge({ status }: { status: string }) {
  const variant =
    status === "paid"
      ? "success"
      : status === "partially_paid"
        ? "warning"
        : status === "refunded"
          ? "muted"
          : "destructive";
  return <Badge variant={variant}>{paymentStatusLabels[status] ?? status}</Badge>;
}
