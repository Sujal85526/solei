import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Constants } from "@/lib/database.types";
import { canMoveTo, nextStatuses, ORDER_STATUS_NEXT, type OrderStatus } from "./status";

const statuses = Constants.public.Enums.order_status as readonly OrderStatus[];

/** Parse `order_status_allowed` from the migration so the TS mirror can't drift. */
function sqlTransitions(): Record<string, string[]> {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20261014000014_orders_admin_notifications.sql"),
    "utf8",
  );
  const fn = sql.slice(sql.indexOf("function public.order_status_allowed"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  const out: Record<string, string[]> = {};
  for (const m of body.matchAll(/when '(\w+)' then p_to in \(([^)]*)\)/g)) {
    out[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  }
  return out;
}

describe("order status transitions", () => {
  it("mirror the database rules exactly", () => {
    const sql = sqlTransitions();
    for (const from of statuses) {
      expect([...ORDER_STATUS_NEXT[from]].sort(), from).toEqual((sql[from] ?? []).sort());
    }
  });

  it("never allow manual moves out of awaiting payment or cancelled", () => {
    expect(ORDER_STATUS_NEXT.pending_payment).toEqual([]);
    expect(ORDER_STATUS_NEXT.cancelled).toEqual([]);
    for (const from of statuses) {
      expect(canMoveTo(from, "pending_payment")).toBe(false);
      expect(canMoveTo(from, "cancelled")).toBe(false);
    }
  });

  it("splits next steps into forward moves and corrections", () => {
    expect(nextStatuses("new")).toEqual({
      forward: ["preparing", "dispatched", "delivered", "completed"],
      back: [],
    });
    expect(nextStatuses("dispatched")).toEqual({
      forward: ["delivered", "completed"],
      back: ["preparing"],
    });
    expect(nextStatuses("completed")).toEqual({ forward: [], back: ["delivered"] });
  });
});
