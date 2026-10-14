import "server-only";
import { must } from "@/lib/supabase/must";
import { createClient } from "@/lib/supabase/server";
import type { OrderExportRow, PaymentExportRow, StockExportRow } from "./tables";

/** Each export is one jsonb document (no PostgREST row cap); the function checks permissions. */
export async function exportOrders(from: string, to: string): Promise<OrderExportRow[]> {
  const supabase = await createClient();
  const data = must(
    await supabase.rpc("export_orders", { p_from: from, p_to: to }),
    "order export",
  );
  return data as unknown as OrderExportRow[];
}

export async function exportPayments(from: string, to: string): Promise<PaymentExportRow[]> {
  const supabase = await createClient();
  const data = must(
    await supabase.rpc("export_payments", { p_from: from, p_to: to }),
    "payment export",
  );
  return data as unknown as PaymentExportRow[];
}

export async function exportStockLevels(): Promise<StockExportRow[]> {
  const supabase = await createClient();
  const data = must(await supabase.rpc("export_stock_levels"), "stock export");
  return data as unknown as StockExportRow[];
}
