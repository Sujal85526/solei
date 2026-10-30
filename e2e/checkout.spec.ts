import { createHash, createHmac } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "./helpers/auth";
import { addToBag, createTestProduct, type TestProduct } from "./helpers/catalog";
import { localEnv } from "./helpers/env";

const mockSecret = () =>
  createHash("sha256").update(`mock-payments:${localEnv().SUPABASE_SECRET_KEY}`).digest("hex");

async function stockOf(variantId: string) {
  const { data } = await adminClient().rpc("online_availability", { p_variant_ids: [variantId] });
  return data![0].available as number;
}

/** The suite's own AED 280 perfume (created in beforeAll). */
let perfume: TestProduct;

/** A verified storefront account (checkout requires one), created directly for the test. */
async function customerAccount() {
  const email = `layla.e2e+${Date.now()}@solei.test`;
  const password = "Solei-e2e-2026";
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Layla", last_name: "Test" },
  });
  if (error) throw error;
  return { email, password };
}

async function checkoutPerfume(page: Page, qty: number, phone: string) {
  const account = await customerAccount();
  await page.goto(`/products/${perfume.slug}`);
  // Plain products have no stepper on the product page: adding opens the bag drawer, set the
  // quantity there.
  await addToBag(page);
  const drawer = page.getByRole("dialog", { name: /Your Cart/ });
  for (let i = 1; i < qty; i++)
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByTestId("cart-count")).toHaveText(String(qty));
  await page.goto("/checkout");
  // Signed-out visitors sign in (or create an account) before the delivery form.
  await page.getByRole("button", { name: /already have an account/i }).click();
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${account.email}`)).toBeVisible();
  await page.getByLabel("Mobile").fill(phone);
  await page.getByLabel("Emirate").click();
  await page.getByRole("option", { name: "Abu Dhabi" }).click();
  await page.getByLabel("Street address").fill("Villa 12, Street 4");
  await page.getByLabel("Area").fill("Al Bateen");
  await page.getByLabel("City").fill("Abu Dhabi");
  await page.getByRole("checkbox", { name: /I agree to the/i }).check();
  const pay = page.getByRole("button", { name: /continue to payment/i });
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.getByText("Test payment · no real card")).toBeVisible();
}

test.describe("checkout & payments", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async ({}, info) => {
    // With a destination, so the paid order shows the passport stamp.
    perfume = await createTestProduct(`checkout-${info.project.name}`, { destination: true });
  });

  test("paying via the hosted page confirms the order and deducts stock once", async ({ page }) => {
    const before = await stockOf(perfume.variantId);
    await checkoutPerfume(page, 2, "050 111 2233");
    // 2 × 280 + delivery (AED 30 Abu Dhabi), unless the bag reaches a free-delivery threshold.
    const { data: settings } = await adminClient()
      .from("settings")
      .select("free_delivery_threshold_fils")
      .single();
    const threshold = settings!.free_delivery_threshold_fils;
    const total = 56_000 + (threshold !== null && 56_000 >= threshold ? 0 : 3_000);
    await expect(page.getByText(`AED ${total / 100}`)).toBeVisible();
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Stamp earned")).toBeVisible();
    expect(await stockOf(perfume.variantId)).toBe(before - 2);

    // Cart cleared after payment (once the confirmation page has hydrated).
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("solei.cart.v1") ?? ""))
      .not.toContain(perfume.variantId);
    await page.goto("/shop");
    await page.getByRole("button", { name: /Cart$/ }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("a declined payment can be retried from the order page", async ({ page }) => {
    await checkoutPerfume(page, 1, "050 222 3344");
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
