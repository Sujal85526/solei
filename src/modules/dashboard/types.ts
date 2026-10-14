import type { Fils } from "@/lib/money";
import type { OrderChannel, OrderStatus } from "@/modules/orders/status";

/** Shape of `public.dashboard_summary()`. Money fields are null without reports.view. */
export type PeriodKey = "today" | "week" | "month";

export type PeriodFigures = {
  orders: number;
  prev_orders: number;
  revenue_fils: Fils | null;
  prev_revenue_fils: Fils | null;
};

export type DashboardSummary = {
  today: string;
  week_start: string;
  month_start: string;
  money: boolean;
  periods: Record<PeriodKey, PeriodFigures>;
  by_channel: { channel: OrderChannel; orders: number; revenue_fils: Fils }[] | null;
  top_products: { product: string; units: number; revenue_fils: Fils | null }[];
  outstanding: { orders: number; total_fils: Fils } | null;
  to_handle: Record<Extract<OrderStatus, "new" | "preparing" | "dispatched">, number>;
  low_stock:
    { sku: string; product: string; variant: string; on_hand: number; threshold: number }[] | null;
  upcoming_events:
    | {
        id: string;
        name: string;
        status: "potential" | "confirmed";
        start_date: string;
        end_date: string;
        location: string | null;
      }[]
    | null;
  pending_bookings: {
    count: number;
    items: {
      id: string;
      ref: string;
      name: string;
      event_date: string;
      status: string;
      created_at: string;
    }[];
  } | null;
};
