import type { NextRequest } from "next/server";
import { assertPermission, PermissionError } from "@/lib/auth/session";
import { escapeHtml } from "@/modules/notifications/render";
import { addressText } from "@/modules/fulfilments/schema";
import { humanize } from "@/modules/orders/format";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * Printable shipping label (A6) for couriers that don't supply one: recipient, address, mobile,
 * order number and tracking number. Plain HTML so it prints cleanly from any browser.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/orders/[id]/label">) {
  try {
    await assertPermission("orders.view");
  } catch (e) {
    if (e instanceof PermissionError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "number, contact_name, contact_phone, delivery_address, delivery_emirate, fulfilments(courier, tracking_number, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) return new Response("Not found", { status: 404 });
  const booking = [...order.fulfilments].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const e = (s: string | null | undefined) => escapeHtml(s ?? "");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Label ${e(order.number)}</title>
<style>
  @page { size: A6; margin: 8mm; }
  body { font: 14px/1.4 system-ui, sans-serif; color: #111; margin: 0; }
  .label { border: 2px solid #111; padding: 12px; max-width: 380px; }
  .from { font-size: 11px; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 10px; }
  .to { font-size: 18px; font-weight: 600; }
  .addr { margin: 4px 0 10px; }
  .row { display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 8px; }
  .track { font: 600 20px/1 ui-monospace, monospace; letter-spacing: 1px; margin-top: 6px; }
  @media print { button { display: none; } }
</style></head><body>
<div class="label">
  <div class="from">From: Solei · Abu Dhabi</div>
  <div class="to">${e(order.contact_name)}</div>
  <div class="addr">${e(addressText(order.delivery_address))}<br>${e(humanize(order.delivery_emirate))}</div>
  <div>${e(order.contact_phone ? formatPhone(order.contact_phone) : "")}</div>
  <div class="row"><span>Order</span><strong>${e(order.number)}</strong></div>
  ${booking ? `<div class="row"><span>${e(booking.courier)}</span></div><div class="track">${e(booking.tracking_number)}</div>` : ""}
</div>
<p><button onclick="print()">Print</button></p>
</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
