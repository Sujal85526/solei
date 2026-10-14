import "server-only";
import { UserError } from "@/lib/action-result";
import { assertPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { adjustSchema, locationSchema, receiveSchema, transferSchema } from "./schema";

function dbError(error: { message: string; code?: string }): never {
  if (error.code === "P0001")
    throw new UserError(error.message.replace(/^.*?: /, "").replace(/^not/, "Not"));
  if (error.code === "42501") throw new UserError("You don't have permission to do that.");
  throw new Error(error.message);
}

export async function receiveStock(input: unknown) {
  await assertPermission("inventory.receive");
  const v = receiveSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_variant_id: v.variantId,
    p_location_id: v.locationId,
    p_type: "receive",
    p_qty: v.qty,
    p_reason: v.reason || "Stock received",
  });
  if (error) dbError(error);
}

export async function adjustStock(input: unknown) {
  await assertPermission("inventory.adjust");
  const v = adjustSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", {
    p_variant_id: v.variantId,
    p_location_id: v.locationId,
    p_type: v.type,
    p_qty: v.signedQty,
    p_reason: v.reason,
  });
  if (error) dbError(error);
  return { variantId: v.variantId, reduced: v.signedQty < 0 };
}

export async function transferStock(input: unknown) {
  await assertPermission("inventory.transfer");
  const v = transferSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_variant_id: v.variantId,
    p_from_location: v.fromLocationId,
    p_to_location: v.toLocationId,
    p_qty: v.qty,
    p_reason: v.reason || undefined,
  });
  if (error) dbError(error);
  return { variantId: v.variantId };
}

export async function saveLocation(input: unknown) {
  await assertPermission("inventory.adjust");
  const v = locationSchema.parse(input);
  const supabase = await createClient();
  const row = { name: v.name, kind: v.kind, sells_online: v.sellsOnline, active: v.active };
  const { error } = v.id
    ? await supabase.from("stock_locations").update(row).eq("id", v.id).neq("kind", "event")
    : await supabase.from("stock_locations").insert(row);
  if (error) throw new Error(error.message);
}
