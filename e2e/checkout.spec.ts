import { createHash, createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "./helpers/auth";
import { localEnv } from "./helpers/env";

const mockSecret = () =>
  createHash("sha256").update(`mock-payments:${localEnv().SUPABASE_SECRET_KEY}`).digest("hex");

async function stockOf(sku: string) {
  const admin = adminClient();
  const { data: v } = await admin.from("product_variants").select("id").eq("sku", sku).single();
  const { data } = await admin.rpc("online_availability", { p_variant_ids: [v!.id] });
  return data![0].available as number;
}

async function checkoutCapri(page: Page, qty: number, phone: string) {
  await page.goto("/products/capri-perfume");
  for (let i = 1; i < qty; i++)
    await page
      .getByRole("button", { name: /increase/i })
      .first()
      .click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Layla Test");
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Email").fill("layla.e2e@solei.test");
  await page.getByLabel("Street, building or villa").fill("Villa 12, Street 4");
  await page.getByLabel("Area").fill("Al Bateen");
  await page.getByLabel("City").fill("Abu Dhabi");
  await page.getByLabel("Emirate").selectOption("abu_dhabi");
  await expect(page.getByRole("button", { name: /^Pay AED/ })).toBeEnabled();
  await page.getByRole("button", { name: /^Pay AED/ }).click();
  await expect(page.getByText("Test payment · no real card")).toBeVisible();
}

test.describe("checkout & payments", () => {
  test.describe.configure({ mode: "serial" });

  test("paying via the hosted page confirms the order and deducts stock once", async ({ page }) => {
    const before = await stockOf("SOL-P-CAP-50");
    await checkoutCapri(page, 2, "050 111 2233");
    await expect(page.getByText("AED 560")).toBeVisible(); // 2 × 280, free delivery from AED 500
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Stamp earned")).toBeVisible();
    expect(await stockOf("SOL-P-CAP-50")).toBe(before - 2);

    // Cart cleared after payment.
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("a declined payment can be retried from the order page", async ({ page }) => {
    await checkoutCapri(page, 1, "050 222 3344");
    await page.getByRole("button", { name: "Decline payment" }).click();
    await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible();
    await expect(page.getByText(/didn't go through/)).toBeVisible();
    await page.getByRole("button", { name: /Complete payment/ }).click();
    await page.getByRole("button", { name: "Pay with test Apple Pay" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("webhooks are verified and idempotent", async ({ request }) => {
    const admin = adminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("provider_ref, amount_fils, order_id")
      .eq("provider", "mock")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    const movementsBefore = await admin
      .from("stock_movements")
      .select("id, order_lines!inner(order_id)", { count: "exact", head: true })
      .eq("order_lines.order_id", payment!.order_id);

    const body = JSON.stringify({
      id: `evt_replay_${Date.now()}`,
      type: "payment.succeeded",
      providerRef: payment!.provider_ref,
      amountFils: payment!.amount_fils,
    });
    const sig = createHmac("sha256", mockSecret()).update(body).digest("hex");

    const bad = await request.post("/api/webhooks/payments/mock", {
      data: body,
      headers: { "content-type": "application/json", "x-mock-signature": "00".repeat(32) },
    });
    expect(bad.status()).toBe(400);

    for (let i = 0; i < 2; i++) {
      const res = await request.post("/api/webhooks/payments/mock", {
        data: body,
        headers: { "content-type": "application/json", "x-mock-signature": sig },
      });
      expect(res.ok()).toBe(true);
    }
    const movementsAfter = await admin
      .from("stock_movements")
      .select("id, order_lines!inner(order_id)", { count: "exact", head: true })
      .eq("order_lines.order_id", payment!.order_id);
    expect(movementsAfter.count).toBe(movementsBefore.count);
  });

  test("customers can track an order with the number and phone", async ({ page }) => {
    const { data: order } = await adminClient()
      .from("orders")
      .select("number")
      .eq("contact_phone", "+971501112233")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    await page.goto("/track");
    await page.getByLabel("Order number").fill(order!.number);
    await page.getByLabel("Mobile number").fill("0501112233");
    await page.getByRole("button", { name: "Track" }).click();
    await expect(page.getByRole("heading", { name: order!.number })).toBeVisible();
    await expect(page.getByText("Order placed")).toBeVisible();
    await page.getByLabel("Mobile number").fill("0509999999");
    await page.getByRole("button", { name: "Track" }).click();
    await expect(page.getByText("couldn't find an order")).toBeVisible();
  });
});
