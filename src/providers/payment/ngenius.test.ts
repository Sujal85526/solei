import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { NgeniusProvider, NGENIUS_WEBHOOK_HEADER, orderRefFrom } = await import("./ngenius");
const { WebhookSignatureError } = await import("./types");

const SANDBOX = "https://api-gateway.sandbox.ngenius-payments.com";
const LIVE = "https://api-gateway.ngenius-payments.com";
const REF = "3b1c6f8e-0d2a-4c55-9a1e-7f3e2b9c1d00";

type Call = [string, RequestInit];
type Route = (url: string, init: RequestInit) => Response | undefined;

/** Fake fetch: answers the token endpoint itself, everything else through `route`. */
function fakeFetch(route: Route, tokenTtl = 300) {
  let tokens = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/identity/auth/access-token")) {
      tokens += 1;
      return Response.json({ access_token: `tok${tokens}`, expires_in: tokenTtl });
    }
    return route(u, init ?? {}) ?? new Response("not found", { status: 404 });
  });
  return fn as unknown as typeof fetch & { mock: { calls: Call[] } };
}

function order(state: string | null, value = 31000, extra: Record<string, unknown> = {}) {
  return {
    reference: REF,
    action: "PURCHASE",
    amount: { currencyCode: "AED", value },
    _embedded: state
      ? { payment: [{ state, amount: { currencyCode: "AED", value }, ...extra }] }
      : {},
  };
}

function provider(http: typeof fetch, over: Partial<{ sandbox: boolean; now: () => number }> = {}) {
  return new NgeniusProvider({
    apiKey: "API_KEY",
    outletRef: "outlet-1",
    sandbox: over.sandbox ?? true,
    webhookSecret: "s3cret",
    http,
    now: over.now,
  });
}

const webhookHeaders = (secret = "s3cret") => new Headers({ [NGENIUS_WEBHOOK_HEADER]: secret });
const webhookBody = (state = "PURCHASED", value = 1) =>
  JSON.stringify({
    eventId: "e1",
    eventName: "PURCHASED",
    outletId: "outlet-1",
    order: {
      reference: REF,
      action: "PURCHASE",
      amount: { value },
      _embedded: { payment: [{ state }] },
    },
  });

const checkout = {
  orderId: "o1",
  orderNumber: "SOL-000042",
  lines: [],
  amountFils: 31000,
  customerEmail: "sara@example.com",
  billing: {
    firstName: "Sara",
    lastName: "Al Mansoori",
    address1: "Villa 12, Saadiyat",
    city: "Abu Dhabi",
  },
  successUrl: "https://solei.test/order/SOL-000042?t=x&paid=1",
  cancelUrl: "https://solei.test/order/SOL-000042?t=x&cancelled=1",
};

describe("NgeniusProvider configuration", () => {
  it("refuses to start without a key or outlet", () => {
    expect(
      () => new NgeniusProvider({ apiKey: "", outletRef: "o", sandbox: true, http: fetch }),
    ).toThrow("NGENIUS_API_KEY");
  });

  it("uses the sandbox or the live gateway", async () => {
    for (const [sandbox, base] of [
      [true, SANDBOX],
      [false, LIVE],
    ] as const) {
      const http = fakeFetch(() => Response.json(order("STARTED")));
      await provider(http, { sandbox }).checkPayment(REF);
      expect(http.mock.calls.map((c) => c[0])).toEqual([
        `${base}/identity/auth/access-token`,
        `${base}/transactions/outlets/outlet-1/orders/${REF}`,
      ]);
    }
  });
});

describe("NgeniusProvider access token", () => {
  it("sends the API key as Basic auth with the identity media type", async () => {
    const http = fakeFetch(() => Response.json(order("STARTED")));
    await provider(http).checkPayment(REF);
    const [, init] = http.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Basic API_KEY",
      "Content-Type": "application/vnd.ni-identity.v1+json",
    });
    expect(http.mock.calls[1][1].headers).toMatchObject({
      Authorization: "Bearer tok1",
      Accept: "application/vnd.ni-payment.v2+json",
    });
  });

  it("reuses the token until 30 seconds before it expires", async () => {
    let now = 1_000_000;
    const http = fakeFetch(() => Response.json(order("STARTED")));
    const p = provider(http, { now: () => now });
    await p.checkPayment(REF);
    now += 260_000; // 4m20s: still inside the 5-minute token less the 30s margin
    await p.checkPayment(REF);
    const tokenCalls = () => http.mock.calls.filter((c) => c[0].endsWith("/access-token")).length;
    expect(tokenCalls()).toBe(1);
    now += 15_000; // 4m35s: within 30s of expiry → refresh
    await p.checkPayment(REF);
    expect(tokenCalls()).toBe(2);
    expect(http.mock.calls.at(-1)![1].headers).toMatchObject({ Authorization: "Bearer tok2" });
  });

  it("fetches one token for concurrent calls", async () => {
    const http = fakeFetch(() => Response.json(order("STARTED")));
    const p = provider(http);
    await Promise.all([p.checkPayment(REF), p.checkPayment(REF), p.checkPayment(REF)]);
    expect(http.mock.calls.filter((c) => c[0].endsWith("/access-token"))).toHaveLength(1);
  });

  it("gets a fresh token once when the API answers 401", async () => {
    let first = true;
    const http = fakeFetch(() => {
      if (first) {
        first = false;
        return new Response("expired", { status: 401 });
      }
      return Response.json(order("PURCHASED"));
    });
    const ev = await provider(http).checkPayment(REF);
    expect(ev.kind).toBe("succeeded");
    expect(http.mock.calls.filter((c) => c[0].endsWith("/access-token"))).toHaveLength(2);
  });
});

describe("NgeniusProvider checkout", () => {
  it("creates a PURCHASE order in fils with billing, redirect and cancel URLs", async () => {
    const http = fakeFetch((url, init) =>
      url.endsWith("/transactions/outlets/outlet-1/orders") && init.method === "POST"
        ? Response.json({
            reference: REF,
            _links: { payment: { href: "https://paypage.sandbox.ngenius-payments.com/?code=abc" } },
          })
        : undefined,
    );
    const s = await provider(http).createCheckout(checkout);
    expect(s).toEqual({
      providerRef: REF,
      url: "https://paypage.sandbox.ngenius-payments.com/?code=abc",
    });
    const [, init] = http.mock.calls[1];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok1",
      "Content-Type": "application/vnd.ni-payment.v2+json",
      Accept: "application/vnd.ni-payment.v2+json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      action: "PURCHASE",
      amount: { currencyCode: "AED", value: 31000 },
      emailAddress: "sara@example.com",
      billingAddress: {
        firstName: "Sara",
        lastName: "Al Mansoori",
        address1: "Villa 12, Saadiyat",
        city: "Abu Dhabi",
        countryCode: "AE",
      },
      merchantOrderReference: "SOL-000042",
      merchantAttributes: {
        redirectUrl: checkout.successUrl,
        cancelUrl: checkout.cancelUrl,
        skipConfirmationPage: true,
      },
    });
  });

  it("fills a missing last name / street so NI's mandatory fields are never empty", async () => {
    const http = fakeFetch(() =>
      Response.json({ reference: REF, _links: { payment: { href: "https://pay" } } }),
    );
    await provider(http).createCheckout({
      ...checkout,
      billing: { firstName: "Sara", lastName: " ", address1: "", city: "Dubai" },
    });
    expect(JSON.parse(http.mock.calls[1][1].body as string).billingAddress).toMatchObject({
      firstName: "Sara",
      lastName: "Sara",
      address1: "Dubai",
      city: "Dubai",
    });
  });

  it("requires the email and billing address", async () => {
    const p = provider(fakeFetch(() => undefined));
    await expect(p.createCheckout({ ...checkout, customerEmail: null })).rejects.toThrow("email");
    await expect(p.createCheckout({ ...checkout, billing: undefined })).rejects.toThrow("billing");
  });

  it("fails when N-Genius returns no payment page", async () => {
    const http = fakeFetch(() => Response.json({ reference: REF }));
    await expect(provider(http).createCheckout(checkout)).rejects.toThrow("payment page");
  });
});

describe("NgeniusProvider webhook", () => {
  it("rejects a missing or wrong secret header without calling N-Genius", async () => {
    const http = fakeFetch(() => Response.json(order("PURCHASED")));
    const p = provider(http);
    await expect(p.parseWebhook(webhookBody(), new Headers())).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    await expect(p.parseWebhook(webhookBody(), webhookHeaders("nope"))).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
    expect(http).not.toHaveBeenCalled();
  });

  it("rejects every webhook when no secret is configured", async () => {
    const http = fakeFetch(() => Response.json(order("PURCHASED")));
    const p = new NgeniusProvider({ apiKey: "k", outletRef: "outlet-1", sandbox: true, http });
    await expect(p.parseWebhook(webhookBody(), webhookHeaders(""))).rejects.toThrow(
      "not configured",
    );
  });

  it("rejects a body without an order reference", async () => {
    const p = provider(fakeFetch(() => undefined));
    await expect(p.parseWebhook("not json", webhookHeaders())).rejects.toThrow("reference");
    await expect(
      p.parseWebhook(JSON.stringify({ order: { reference: "../x" } }), webhookHeaders()),
    ).rejects.toThrow("reference");
  });

  it("re-fetches the order: paid only on NI's answer, amount from NI, not the body", async () => {
    const http = fakeFetch((url) =>
      url.endsWith(`/orders/${REF}`) ? Response.json(order("PURCHASED", 31000)) : undefined,
    );
    const ev = await provider(http).parseWebhook(webhookBody("PURCHASED", 1), webhookHeaders());
    expect(ev).toMatchObject({
      kind: "succeeded",
      eventId: `${REF}:PURCHASED`,
      providerRef: REF,
      amountFils: 31000,
      method: "online_card",
    });
    expect(http.mock.calls[1][0]).toBe(`${SANDBOX}/transactions/outlets/outlet-1/orders/${REF}`);
  });

  it("trusts NI over the payload: a body saying PURCHASED for a STARTED order is ignored", async () => {
    const http = fakeFetch(() => Response.json(order("STARTED")));
    const ev = await provider(http).parseWebhook(webhookBody("PURCHASED"), webhookHeaders());
    expect(ev).toMatchObject({ kind: "ignored", eventId: `${REF}:STARTED` });
  });

  it("treats an order unknown to our outlet as a bad signature", async () => {
    const p = provider(fakeFetch(() => new Response("no", { status: 404 })));
    await expect(p.parseWebhook(webhookBody(), webhookHeaders())).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });

  it("lets server errors through so they are not mistaken for forged webhooks", async () => {
    const p = provider(fakeFetch(() => new Response("down", { status: 503 })));
    await expect(p.checkPayment(REF)).rejects.toThrow("N-Genius API 503");
  });
});

describe("NgeniusProvider state mapping", () => {
  const check = (body: unknown) => provider(fakeFetch(() => Response.json(body))).checkPayment(REF);

  it("maps PURCHASED and CAPTURED to succeeded", async () => {
    expect(await check(order("PURCHASED"))).toMatchObject({ kind: "succeeded" });
    expect(await check(order("CAPTURED"))).toMatchObject({
      kind: "succeeded",
      eventId: `${REF}:CAPTURED`,
    });
  });

  it("maps FAILED to failed with NI's message", async () => {
    expect(
      await check(order("FAILED", 31000, { authResponse: { resultMessage: "Do not honour" } })),
    ).toMatchObject({ kind: "failed", eventId: `${REF}:FAILED`, reason: "Do not honour" });
    expect(await check(order("FAILED"))).toMatchObject({
      kind: "failed",
      reason: "Payment failed",
    });
  });

  it("ignores in-progress states and orders without a payment yet", async () => {
    for (const state of ["STARTED", "AWAIT_3DS", "AUTHORISED"])
      expect(await check(order(state))).toMatchObject({
        kind: "ignored",
        eventId: `${REF}:${state}`,
        type: `order.${state.toLowerCase()}`,
      });
    expect(await check(order(null))).toMatchObject({ kind: "ignored", type: "order.no_payment" });
  });

  it("uses a successful attempt when an earlier one failed", async () => {
    const o = order("FAILED");
    o._embedded.payment!.push({
      state: "PURCHASED",
      amount: { currencyCode: "AED", value: 31000 },
    });
    expect(await check(o)).toMatchObject({ kind: "succeeded" });
  });

  it("never confirms a payment whose amount or currency doesn't match the order", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const short = order("PURCHASED");
    short._embedded.payment![0].amount = { currencyCode: "AED", value: 100 };
    expect(await check(short)).toMatchObject({ kind: "ignored", type: "payment.amount_mismatch" });
    const usd = { ...order("PURCHASED"), amount: { currencyCode: "USD", value: 31000 } };
    expect(await check(usd)).toMatchObject({ kind: "ignored", type: "payment.amount_mismatch" });
    error.mockRestore();
  });
});

describe("orderRefFrom", () => {
  it("reads order.reference and rejects anything odd", () => {
    expect(orderRefFrom(JSON.stringify({ order: { reference: REF } }))).toBe(REF);
    expect(orderRefFrom(JSON.stringify({ reference: REF }))).toBeNull();
    expect(orderRefFrom("null")).toBeNull();
    expect(orderRefFrom("{")).toBeNull();
  });
});
