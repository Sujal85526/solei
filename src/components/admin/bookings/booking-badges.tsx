import { Badge } from "@/components/ui/badge";
import type { BookingStatus, QuoteStatus } from "@/modules/bookings/types";

type Variant = "default" | "secondary" | "success" | "warning" | "muted" | "pink" | "destructive";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "New request",
  in_review: "In review",
  quoted: "Quoted",
  accepted: "Accepted",
  confirmed: "Confirmed",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const statusVariant: Record<BookingStatus, Variant> = {
  requested: "pink",
  in_review: "warning",
  quoted: "secondary",
  accepted: "warning",
  confirmed: "success",
  completed: "muted",
  rejected: "destructive",
  cancelled: "destructive",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={statusVariant[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

const quoteVariant: Record<QuoteStatus, Variant> = {
  sent: "secondary",
  accepted: "success",
  superseded: "muted",
  withdrawn: "muted",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <Badge variant={quoteVariant[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
  );
}
