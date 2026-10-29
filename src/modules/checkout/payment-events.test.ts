import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** In-memory stand-in for the parts of the admin client applyPaymentEvent uses. */
const db = {
  events: new Map<string, { id: string; processed: boolean }>(),
  pending: [] as { provider_ref: string }[],
  /** Method of the payment row being confirmed (method lookup). */
  attemptMethod: null as string | null,
  rpcError: null as string | null,
  rpc: vi.fn(),
};
const onOrderPaid = vi.fn();
const onBookingOrderPaid = vi.fn();
const onPaymentFailed = vi.fn();
const checkPayment = vi.fn();

function table(name: string) {
  if (name === "payments") {
    let cols = "";
    const q = {
      select: (c: string) => {
        cols = c;
        return q;
      },
      in: () => q,
      eq: () => q,
      not: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: async () =>
        cols === "method"
          ? { data: db.attemptMethod ? { method: db.attemptMethod } : null }
          : { data: db.pending[0] ?? null },
    };
    return q;
  }
  return {
    insert: (row: { provider: string; event_id: string }) => ({
      select: () => ({
        single: async () => {
          const key = `${row.provider}:${row.event_id}`;
          if (db.events.has(key)) return { data: null, error: { code: "23505", message: "dup" } };
          const id = `log-${db.events.size + 1}`;
          db.events.set(key, { id, processed: false });
          return { data: { id }, error: null };
        },
      }),
    }),
    update: () => ({
      eq: async (_: string, id: string) => {
        for (const v of db.events.values()) if (v.id === id) v.processed = true;
      },
    }),
    delete: () => ({
      eq: async (_: string, id: string) => {
        for (const [k, v] of db.events) if (v.id === id) db.events.delete(k);
      },
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: table,
    rpc: (fn: string, args: unknown) => {
      db.rpc(fn, args);
      const error = db.rpcError ? { message: db.rpcError } : null;
      if (fn === "fail_payment") return Promise.resolve({ data: error ? null : "order-1", error });
      // confirm_payment: newly paid the first time only, like the RPC.
      const first = db.rpc.mock.calls.filter(([f]) => f === "confirm_payment").length === 1;
      return {
        single: async () => ({
          data: error ? null : { order_id: "order-1", order_number: "SOL-1", newly_paid: first },
          error,
        }),
      };
    },
  }),
}));
vi.mock("@/modules/orders/events", () => ({ onOrderPaid, onPaymentFailed }));
vi.mock("@/modules/bookings/events", () => ({ onBookingOrderPaid }));
vi.mock("@/providers/payment", () => ({
  paymentProvider: () => ({ name: "ngenius", checkPayment }),
}));

const { applyPaymentEvent, confirmOnReturn } = await import("./payment-events");

const paid = {
  kind: "succeeded" as const,
  eventId: "ref-1:PURCHASED",
  providerRef: "ref-1",
  amountFils: 31000,
  method: "online_card" as const,
  raw: {},
};

beforeEach(() => {
  db.events.clear();
  db.pending = [];
  db.rpcError = null;
  db.attemptMethod = null;
  vi.clearAllMocks();
});

describe("applyPaymentEvent", () => {
  it("confirms once: a repeat of the same event is a duplicate with no second email", async () => {
    expect(await applyPaymentEvent("ngenius", paid)).toBe("processed");
    expect(await applyPaymentEvent("ngenius", paid)).toBe("duplicate");
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(onOrderPaid).toHaveBeenCalledTimes(1);
    expect(onOrderPaid).toHaveBeenCalledWith({ id: "order-1", number: "SOL-1" });
    expect(onBookingOrderPaid).toHaveBeenCalledTimes(1);
    expect([...db.events.values()][0].processed).toBe(true);
  });

  it("records the card method, but keeps payment_link for staff payment links", async () => {
    db.attemptMethod = "online_card";
    await applyPaymentEvent("ngenius", paid);
    expect(db.rpc.mock.calls[0][1]).toMatchObject({ p_method: "online_card" });
    db.events.clear();
    db.attemptMethod = "payment_link";
    await applyPaymentEvent("ngenius", paid);
    expect(db.rpc.mock.calls[1][1]).toMatchObject({ p_method: "payment_link" });
  });

  it("sends nothing when the RPC says the order was already paid", async () => {
    await applyPaymentEvent("ngenius", paid);
    // A different event id (e.g. CAPTURED after PURCHASED) reaches the RPC, which is idempotent.
    await applyPaymentEvent("ngenius", { ...paid, eventId: "ref-1:CAPTURED" });
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(onOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("marks failures and sends the retry email", async () => {
    await applyPaymentEvent("ngenius", {
      kind: "failed",
      eventId: "ref-1:FAILED",
      providerRef: "ref-1",
      reason: "Declined",
      raw: {},
    });
    expect(db.rpc).toHaveBeenCalledWith("fail_payment", {
      p_provider: "ngenius",
      p_provider_ref: "ref-1",
      p_reason: "Declined",
    });
    expect(onPaymentFailed).toHaveBeenCalledWith("order-1");
  });

  it("only logs ignored events", async () => {
    await applyPaymentEvent("ngenius", { kind: "ignored", eventId: "ref-1:STARTED", type: "x" });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.events.size).toBe(1);
  });

  it("removes the log row when processing fails, so it can be processed again", async () => {
    db.rpcError = "boom";
    await expect(applyPaymentEvent("ngenius", paid)).rejects.toThrow("boom");
    expect(db.events.size).toBe(0);
    db.rpcError = null;
    expect(await applyPaymentEvent("ngenius", paid)).toBe("processed");
  });
});

describe("confirmOnReturn", () => {
  it("asks the provider about the pending attempt and applies the answer", async () => {
    db.pending = [{ provider_ref: "ref-1" }];
    checkPayment.mockResolvedValue(paid);
    await confirmOnReturn(["order-1"]);
    expect(checkPayment).toHaveBeenCalledWith("ref-1");
    expect(onOrderPaid).toHaveBeenCalledTimes(1);
    // The webhook arriving afterwards is a duplicate.
    expect(await applyPaymentEvent("ngenius", paid)).toBe("duplicate");
    expect(onOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a pending attempt, and never throws", async () => {
    await confirmOnReturn(["order-1"]);
    expect(checkPayment).not.toHaveBeenCalled();
    db.pending = [{ provider_ref: "ref-1" }];
    checkPayment.mockRejectedValue(new Error("N-Genius API 503"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(confirmOnReturn(["order-1"])).resolves.toBeUndefined();
    error.mockRestore();
  });
});
