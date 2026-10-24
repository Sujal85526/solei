import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { humanize } from "@/modules/orders/format";
import { changeStatus } from "@/modules/orders/service";
import { notifyOrderStatus } from "@/modules/orders/notify";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { courierProvider } from "@/providers/courier";
import type { ShipmentStatus } from "@/providers/courier/types";
import { addressText, canBook, isOpen } from "./schema";

/**
 * Book the order with the courier, then mark it dispatched with the tracking number (which sends
 * the "on its way" email / WhatsApp as usual). Returns the tracking number.
 */
export async function bookCourier(orderId: string): Promise<string> {
  const staff = await assertPermission("orders.update");
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, number, status, fulfilment, contact_name, contact_phone, delivery_address, delivery_emirate, order_lines(qty)",
    )
    .eq("id", orderId)
    .single();
  if (error) throw new Error(error.message);
  if (!canBook(order))
    throw new UserError("Only delivery orders that are new or being prepared can be booked.");
  const { count } = await supabase
    .from("fulfilments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .not("status", "in", "(failed,cancelled)");
  if (count) throw new UserError("This order is already booked with the courier.");

  const provider = courierProvider();
  const { data: summary } = await supabase
    .from("order_payment_summary")
    .select("outstanding_fils")
    .eq("order_id", orderId)
    .maybeSingle();
  const outstanding = summary?.outstanding_fils ?? 0;
  const shipment = await provider.createShipment({
    orderNumber: order.number,
    recipient: {
      name: order.contact_name ?? "Customer",
      phone: order.contact_phone,
      address: addressText(order.delivery_address),
      emirate: order.delivery_emirate ? humanize(order.delivery_emirate) : null,
    },
    pieces: order.order_lines.reduce((s, l) => s + l.qty, 0),
    codFils: Math.max(0, outstanding),
  });
  const { error: insertError } = await supabase.from("fulfilments").insert({
    order_id: orderId,
    provider: provider.name,
    courier: shipment.courier,
    tracking_number: shipment.trackingNumber,
    label_url: shipment.labelUrl,
    booked_by: staff.userId,
    events: [{ at: new Date().toISOString(), status: "booked", description: "Shipment booked" }],
  });
  if (insertError) throw new Error(insertError.message);
  await changeStatus({
    orderId,
    status: "dispatched",
    trackingNumber: shipment.trackingNumber,
    courier: shipment.courier,
  });
  return shipment.trackingNumber;
}

type FulfilmentRow = {
  id: string;
  order_id: string;
  provider: string;
  tracking_number: string;
  status: ShipmentStatus;
  created_at: string;
};

/**
 * Ask the courier where a parcel is; when it's delivered, the order is marked delivered (with the
 * usual email). Used by the admin "Refresh" and the scheduler (service role).
 */
async function refresh(f: FulfilmentRow): Promise<ShipmentStatus> {
  const admin = createAdminClient();
  const tracking = await courierProvider().track(f.tracking_number, new Date(f.created_at));
  await admin
    .from("fulfilments")
    .update({
      status: tracking.status,
      events: tracking.events,
      last_checked_at: new Date().toISOString(),
    })
    .eq("id", f.id);
  if (tracking.status === "delivered" && f.status !== "delivered") {
    const { data: order } = await admin
      .from("orders")
      .select("status")
      .eq("id", f.order_id)
      .single();
    if (order?.status === "dispatched") {
      await admin.from("orders").update({ status: "delivered" }).eq("id", f.order_id);
      await notifyOrderStatus(f.order_id, "delivered");
    }
  }
  return tracking.status;
}

export async function refreshTracking(fulfilmentId: string): Promise<ShipmentStatus> {
  await assertPermission("orders.update");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fulfilments")
    .select("id, order_id, provider, tracking_number, status, created_at")
    .eq("id", fulfilmentId)
    .single();
  if (error) throw new Error(error.message);
  return refresh(data);
}

/** Scheduler: every parcel still on its way. */
export async function refreshOpenFulfilments(): Promise<{ checked: number; delivered: number }> {
  const { data, error } = await createAdminClient()
    .from("fulfilments")
    .select("id, order_id, provider, tracking_number, status, created_at")
    .not("status", "in", "(delivered,failed,cancelled)")
    .limit(200);
  if (error) throw new Error(error.message);
  let delivered = 0;
  for (const f of data.filter((x) => isOpen(x.status))) {
    if ((await refresh(f)) === "delivered") delivered++;
  }
  return { checked: data.length, delivered };
}

export async function fulfilmentsForOrder(orderId: string) {
  await assertPermission("orders.view");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fulfilments")
    .select(
      "id, provider, courier, tracking_number, label_url, status, events, created_at, last_checked_at",
    )
    .eq("order_id", orderId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data;
}
