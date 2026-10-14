import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];
export type OrderStatus = Enums["order_status"];
export type PaymentMethod = Enums["payment_method"];
export type StockMovementType = Enums["stock_movement_type"];
export type ExpenseCategory = Enums["event_expense_category"];

/** Facts returned by `event_report_data()` for one event (see migration 20261014500001). */
export type ReportEvent = {
  id: string;
  name: string;
  type: Enums["event_type"];
  status: Enums["event_status"];
  start_date: string;
  end_date: string;
  location: string | null;
  emirate: Enums["emirate"] | null;
  closed_at: string | null;
  /** null without reports.financial.view */
  participation_fee_fils: number | null;
  fee_payment_status: Enums["fee_payment_status"] | null;
};

export type OrderFact = {
  id: string;
  number: string;
  event_day: string | null;
  placed_at: string;
  status: OrderStatus;
  channel: Enums["order_channel"];
  total_fils: number;
  vat_fils: number;
  discount_fils: number;
};

export type LineFact = {
  order_id: string;
  variant_id: string;
  product_name: string;
  variant_label: string;
  sku: string;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  destination_id: string | null;
  destination_name: string | null;
  qty: number;
  line_total_fils: number;
  is_reward: boolean;
  /** Cost snapshot; null without reports.financial.view or when no snapshot was taken. */
  unit_cost_fils: number | null;
};

export type PaymentFact = {
  order_id: string;
  kind: "payment" | "refund";
  method: PaymentMethod;
  amount_fils: number;
};

export type StockFact = {
  day: string;
  variant_id: string;
  product_name: string;
  variant_label: string;
  sku: string;
  sort: number;
  type: StockMovementType;
  qty: number;
};

export type ExpenseFact = {
  category: ExpenseCategory;
  amount_fils: number;
  incurred_on: string;
  note: string | null;
};

export type ReportFacts = {
  event: ReportEvent;
  financial: boolean;
  orders: OrderFact[];
  lines: LineFact[];
  payments: PaymentFact[];
  stock: StockFact[];
  expenses: ExpenseFact[];
};

/** "all" or one business day `YYYY-MM-DD`. */
export type ReportScope = "all" | string;
