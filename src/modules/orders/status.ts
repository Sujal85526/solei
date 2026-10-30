import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type OrderStatus = Enums["order_status"];
export type OrderChannel = Enums["order_channel"];
export type PaymentMethod = Enums["payment_method"];
export type PaymentStatus = "pending" | "partially_paid" | "paid" | "refunded";

/**
 * Manual status moves staff may make. Mirrors `public.order_status_allowed` (the database is the
 * enforcer; this drives which buttons are shown). Payment confirms `pending_payment → new`;
 * cancelling is a separate action.
 */
export const ORDER_STATUS_NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: [],
  new: ["preparing", "dispatched", "delivered", "completed"],
  preparing: ["new", "dispatched", "delivered", "completed"],
  dispatched: ["preparing", "delivered", "completed"],
  delivered: ["dispatched", "completed"],
  completed: ["delivered"],
  cancelled: [],
};

export function canMoveTo(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_NEXT[from].includes(to);
}

/** Forward moves first (the usual next step), then corrections backwards. */
const FLOW: OrderStatus[] = ["new", "preparing", "dispatched", "delivered", "completed"];
export function nextStatuses(from: OrderStatus): { forward: OrderStatus[]; back: OrderStatus[] } {
  const at = FLOW.indexOf(from);
  const all = ORDER_STATUS_NEXT[from];
  return {
    forward: all.filter((s) => FLOW.indexOf(s) > at),
    back: all.filter((s) => FLOW.indexOf(s) < at),
  };
}

export const canCancel = (s: OrderStatus) => s !== "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  new: "New",
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Button labels for moving to a status. */
export const ORDER_STATUS_ACTIONS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  new: "Back to new",
  preparing: "Mark preparing",
  dispatched: "Mark dispatched",
  delivered: "Mark delivered",
  completed: "Mark completed",
  cancelled: "Cancel",
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  website: "Website",
  pos: "Event POS",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  direct: "Direct",
  payment_link: "Payment link",
  booking: "Booking",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Unpaid",
  partially_paid: "Part paid",
  paid: "Paid",
  refunded: "Refunded",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  online_card: "Online card",
  apple_pay: "Apple Pay",
  cash: "Cash",
  card_terminal: "Card terminal",
  soft_pos: "Soft POS",
  bank_transfer: "Bank transfer",
  payment_link: "Payment link",
  gift_card: "Gift card",
  loyalty_points: "Points",
  other: "Other",
};

/** Methods staff can record by hand (online ones only come from verified webhooks). */
export const MANUAL_PAYMENT_METHODS = [
  "cash",
  "card_terminal",
  "soft_pos",
  "bank_transfer",
  "other",
] as const satisfies readonly PaymentMethod[];

/** Statuses that tell the customer something (each has an email template). */
export const CUSTOMER_STATUS_TEMPLATES: Partial<Record<OrderStatus, string>> = {
  preparing: "order_preparing",
  dispatched: "order_dispatched",
  delivered: "order_delivered",
};
