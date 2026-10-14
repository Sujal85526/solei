import { createHash, createHmac, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { localEnv } from "./helpers/env";

/*
 * Orders admin. Orders are created like the checkout does (create_web_order) on a dedicated
 * product so these tests never race the checkout tests' stock assertions; online payments go
 * through the real signed mock webhook so the same confirmation + email path runs.
 */

const PRICE = 12_000; // AED 120
const mockSecret = () =>
  createHash("sha256").update(`mock-payments:${localEnv().SUPABASE_SECRET_KEY}`).digest("hex");

type Fixture = { variantId: string; sku: string; locationId: string };

async function createProduct(tag: string): Promise<Fixture> {
  const admin = adminClient();
  const { data: cat } = await admin.from("categories").select("id").limit(1).single();
  const slug = `e2e-orders-${tag}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const { data: product, error } = await admin
    .from("products")
    .insert({ name: `E2E Orders ${tag}`, slug, category_id: cat!.id })
    .select("id")
    .single();
  if (error) throw error;
  const sku = `E2E-ORD-${tag}`.toUpperCase().slice(0, 40);
  const { data: variant, error: e2 } = await admin
    .from("product_variants")
    .insert({ product_id: product.id, label: "50 ml", sku, price_fils: PRICE })
    .select("id")
    .single();
  if (e2) throw e2;
  const { data: loc } = await admin
    .from("stock_locations")
    .select("id")
    .eq("is_default", true)
    .single();
  await admin
    .from("stock_movements")
    .insert({ variant_id: variant.id, location_id: loc!.id, qty: 50, type: "receive" });
  return { variantId: variant.id, sku, locationId: loc!.id };
}

async function onHand(f: Fixture) {
  const { data } = await adminClient()
    .from("stock_movements")
    .select("qty")
    .eq("variant_id", f.variantId)
    .eq("location_id", f.locationId);
  return (data ?? []).reduce((s, m) => s + m.qty, 0);
}

async function createOrder(f: Fixture, qty: number, name: string) {
  const total = PRICE * qty;
  const { data, error } = await adminClient()
    .rpc("create_web_order", {
      p: {
        client_uuid: randomUUID(),
        fulfilment: "delivery",
        emirate: "dubai",
        contact: { name, phone: "+971501230070", email: "orders.e2e@solei.test" },
        address: { line1: "Villa 7", area: "Jumeirah", city: "Dubai", emirate: "dubai" },
        lines: [{ variant_id: f.variantId, qty, unit_price_fils: PRICE }],
        subtotal_fils: total,
        delivery_fee_fils: 0,
        vat_fils: 0,
        total_fils: total,
        vat_rate_bp: 500,
        prices_include_vat: true,
      },
    })
    .single<{ order_id: string; order_number: string }>();
  if (error) throw error;
  return { id: data!.order_id, number: data!.order_number, total };
}

/** Pay online through the signed mock webhook (or decline it). */
async function payOnline(
  request: APIRequestContext,
  order: { id: string; total: number },
  outcome: "succeeded" | "failed" = "succeeded",
) {
  const ref = `mock_cs_e2e_${randomUUID()}`;
  const { error } = await adminClient().from("payments").insert({
    order_id: order.id,
    kind: "payment",
    amount_fils: order.total,
    method: "online_card",
    status: "pending",
    provider: "mock",
    provider_ref: ref,
  });
  if (error) throw error;
  const body = JSON.stringify({
    id: `evt_e2e_${randomUUID()}`,
    type: `payment.${outcome}`,
    providerRef: ref,
    amountFils: order.total,
  });
  const res = await request.post("/api/webhooks/payments/mock", {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-mock-signature": createHmac("sha256", mockSecret()).update(body).digest("hex"),
    },
  });
  expect(res.ok()).toBe(true);
}

async function openOrder(page: Page, number: string) {
  await page.goto(`/admin/orders?q=${number}`);
  await page.getByRole("link", { name: number }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: number })).toBeVisible();
}

test.describe("orders admin", () => {
  test.afterAll(async () => {
    await adminClient().from("products").update({ active: false }).like("name", "E2E Orders %");
  });

  test("filters the list and marks an order dispatched with tracking", async ({
    page,
    request,
  }, info) => {
    const tag = `${info.project.name}-${Date.now()}`;
    const f = await createProduct(`f-${tag}`);
    const order = await createOrder(f, 1, `Filter ${tag}`);
    await payOnline(request, order);

    await signInAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByText("Today's orders")).toBeVisible();

    // Search + filters narrow the list; a non-matching filter hides it.
    await page.getByLabel("Search orders").fill(order.number);
    await page.getByLabel("Channel", { exact: true }).selectOption("website");
    await page.getByLabel("Status", { exact: true }).selectOption("new");
    await page.getByLabel("Payment", { exact: true }).selectOption("paid");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/channel=website/);
    await expect(page.getByRole("link", { name: order.number }).first()).toBeVisible();
    await page.getByLabel("Channel", { exact: true }).selectOption("pos");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("No orders match these filters.")).toBeVisible();

    await openOrder(page, order.number);
    await page.getByRole("button", { name: "Mark dispatched" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tracking number").fill("AX-E2E-1");
    await dialog.getByLabel("Courier").fill("Aramex");
    await dialog.getByRole("button", { name: "Mark dispatched" }).click();
    await expect(page.getByText("Order marked dispatched.")).toBeVisible();
    await expect(page.getByText("Courier: Aramex · Tracking number: AX-E2E-1")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark delivered" })).toBeVisible();

    // The dispatch email is logged with the order.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(`Your Solei order ${order.number} is on its way`)).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
  });

  test("records a part payment, then the balance, which confirms the order and deducts stock", async ({
    page,
  }, info) => {
    const tag = `${info.project.name}-${Date.now()}`;
    const f = await createProduct(`p-${tag}`);
    const order = await createOrder(f, 2, `Payments ${tag}`);
    const before = await onHand(f);

    await signInAsOwner(page);
    await page.goto(`/admin/orders/${order.id}`);
    await expect(page.getByText("Awaiting payment").first()).toBeVisible();
    await expect(page.getByTestId("outstanding")).toHaveText("AED 240");

    await page.getByRole("button", { name: "Record payment" }).click();
    let dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Amount (AED)")).toHaveValue("240.00");
    await dialog.getByLabel("Amount (AED)").fill("100");
    await dialog.getByLabel("Method").selectOption("bank_transfer");
    await dialog.getByLabel("Reference").fill("TRX-77");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Payment recorded. AED 140 still outstanding.")).toBeVisible();
    await expect(page.getByTestId("outstanding")).toHaveText("AED 140");
    expect(await onHand(f)).toBe(before);

    await page.getByRole("button", { name: "Record payment" }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Amount (AED)")).toHaveValue("140.00");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Payment recorded. The order is fully paid.")).toBeVisible();
    await expect(page.getByTestId("outstanding")).toHaveText("AED 0");
    await expect(page.getByRole("button", { name: "Mark preparing" })).toBeVisible();
    expect(await onHand(f)).toBe(before - 2);
  });

  test("cancelling a paid order returns its stock once", async ({ page, request }, info) => {
    const tag = `${info.project.name}-${Date.now()}`;
    const f = await createProduct(`c-${tag}`);
    const order = await createOrder(f, 3, `Cancel ${tag}`);
    const before = await onHand(f);
    await payOnline(request, order);
    await expect.poll(() => onHand(f)).toBe(before - 3);

    await signInAsOwner(page);
    await page.goto(`/admin/orders/${order.id}`);
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel order" }).click();
    await expect(dialog.getByText(/Say why/)).toBeVisible();
    await dialog.getByLabel("Reason").fill("Customer changed their mind");
    await expect(dialog.getByLabel("Return the items to stock")).toBeChecked();
    await dialog.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Order cancelled and stock returned.")).toBeVisible();
    await expect(page.getByText(/Customer changed their mind/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    expect(await onHand(f)).toBe(before);
  });

  test("the outbox shows logged confirmation and payment-failed emails", async ({
    page,
    request,
  }, info) => {
    const tag = `${info.project.name}-${Date.now()}`;
    const f = await createProduct(`o-${tag}`);
    const paid = await createOrder(f, 1, `Outbox ${tag}`);
    await payOnline(request, paid);
    const declined = await createOrder(f, 1, `Declined ${tag}`);
    await payOnline(request, declined, "failed");

    await signInAsOwner(page);
    await expect(async () => {
      await page.goto(`/admin/settings/notifications/outbox?q=${paid.number}`);
      await expect(page.getByText(`Your Solei order ${paid.number} is confirmed`)).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText(/via log/).first()).toBeVisible();
    await expect(page.getByText("Sent").first()).toBeVisible();

    await expect(async () => {
      await page.goto(`/admin/settings/notifications/outbox?q=${declined.number}`);
      await expect(
        page.getByText(`Your payment for ${declined.number} didn't go through`),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  });

  test("templates preview live and send a test to the signed-in user", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/settings");
    await page.getByRole("link", { name: /Notifications/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await page.getByRole("link", { name: /Order delivered/ }).click();
    await page.getByLabel("Subject").fill("Delivered: {{order_number}}");
    await expect(page.getByTestId("preview-subject")).toHaveText("Delivered: SOL-001234");
    await page.getByRole("button", { name: "Send test to me" }).click();
    await expect(page.getByText(/Test (logged|sent) for|Test sent to/)).toBeVisible();
  });
});
