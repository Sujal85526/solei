import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { ZiinaProvider, intentIdFrom } = await import("./ziina");

function fakeFetch(intent: Record<string, unknown> | null, status = 200) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    if (!intent) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(intent), { status });
  }) as unknown as typeof fetch;
}

describe("intentIdFrom", () => {
  it("finds the id in common webhook shapes", () => {
    expect(intentIdFrom(JSON.stringify({ data: { id: "pi_abc123" } }))).toBe("pi_abc123");
    expect(intentIdFrom(JSON.stringify({ id: "abc_123456" }))).toBe("abc_123456");
    expect(intentIdFrom("not json")).toBeNull();
    expect(intentIdFrom(JSON.stringify({ id: "../../etc" }))).toBeNull();
  });
});

describe("ZiinaProvider webhook", () => {
  it("marks paid only when Ziina's API says completed (amount from Ziina, not the body)", async () => {
    const http = fakeFetch({
      id: "pi_123456",
      status: "completed",
      amount: 30000,
      currency_code: "AED",
    });
    const p = new ZiinaProvider("key", false, http);
    const ev = await p.parseWebhook(JSON.stringify({ data: { id: "pi_123456", amount: 1 } }));
    expect(ev).toMatchObject({ kind: "succeeded", providerRef: "pi_123456", amountFils: 30000 });
    expect(http).toHaveBeenCalledWith(
      "https://api-v2.ziina.com/api/payment_intent/pi_123456",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer key" }),
      }),
    );
  });

  it("reports failures and ignores in-progress intents", async () => {
    const failed = new ZiinaProvider(
      "k",
      false,
      fakeFetch({
        id: "pi_123456",
        status: "failed",
        amount: 1,
        currency_code: "AED",
        latest_error: { message: "Declined" },
      }),
    );
    expect(await failed.parseWebhook('{"id":"pi_123456"}')).toMatchObject({
      kind: "failed",
      reason: "Declined",
    });
    const pending = new ZiinaProvider(
      "k",
      false,
      fakeFetch({ id: "pi_123456", status: "pending", amount: 1, currency_code: "AED" }),
    );
    expect(await pending.parseWebhook('{"id":"pi_123456"}')).toMatchObject({ kind: "ignored" });
  });

  it("rejects notifications for intents Ziina doesn't know", async () => {
    const p = new ZiinaProvider("k", false, fakeFetch(null));
    await expect(p.parseWebhook('{"id":"pi_unknown1"}')).rejects.toThrow("Unknown payment intent");
  });
});

describe("ZiinaProvider checkout", () => {
  it("creates a payment intent in fils and returns the hosted page", async () => {
    const http = fakeFetch({
      id: "pi_777777",
      status: "requires_payment_instrument",
      amount: 31000,
      currency_code: "AED",
      redirect_url: "https://pay.ziina.com/x",
    });
    const p = new ZiinaProvider("k", true, http);
    const s = await p.createCheckout({
      orderId: "o1",
      orderNumber: "SOL-000001",
      lines: [],
      amountFils: 31000,
      successUrl: "https://s",
      cancelUrl: "https://c",
    });
    expect(s).toMatchObject({ providerRef: "pi_777777", url: "https://pay.ziina.com/x" });
    const body = JSON.parse(
      (http as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1]
        .body as string,
    );
    expect(body).toMatchObject({
      amount: 31000,
      currency_code: "AED",
      test: true,
      success_url: "https://s",
    });
  });
});
