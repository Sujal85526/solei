import { Badge } from "@/components/ui/badge";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type OrderChannel,
  type OrderStatus,
  type PaymentStatus,
} from "@/modules/orders/status";

type Variant = "default" | "secondary" | "success" | "warning" | "muted" | "pink" | "destructive";

const statusVariant: Record<OrderStatus, Variant> = {
  pending_payment: "muted",
  new: "pink",
  preparing: "warning",
  dispatched: "secondary",
  delivered: "success",
  completed: "success",
  cancelled: "destructive",
};

const paymentVariant: Record<PaymentStatus, Variant> = {
  pending: "warning",
  partially_paid: "warning",
  paid: "success",
  refunded: "muted",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={statusVariant[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "pending") as PaymentStatus;
  return <Badge variant={paymentVariant[s] ?? "muted"}>{PAYMENT_STATUS_LABELS[s] ?? status}</Badge>;
}

export function ChannelBadge({ channel }: { channel: OrderChannel }) {
  return <Badge variant="outline">{CHANNEL_LABELS[channel]}</Badge>;
}
