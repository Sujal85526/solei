import { expect, test, type Browser } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { formatAED } from "../src/lib/money";
import { createTestProduct, type TestProduct } from "./helpers/catalog";
import { withLock } from "./helpers/lock";

/*
 * Discount codes and points at the event till (P2-64, P2-67). Each test sells the suite's own
 * AED 280 perfume from a fresh event's stock, so the event's day summary and stock are its own.
 */

/** A confirmed event today with 10 of the product in its stock. */
async function eventWithStock(name: string, product: TestProduct) {
  const admin = adminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const { data: event, error } = await admin
    .from("events")
    .insert({ name, type: "popup", status: "confirmed", start_date: today, end_date: today })
    .select("id")
    .single();
  if (error) throw error;
  const { data: loc } = await admin
    .from("stock_locations")
    .select("id")
    .eq("event_id", event.id)
    .single();
  const { error: e2 } = await admin.from("stock_movements").insert({
    variant_id: product.variantId,
    location_id: loc!.id,
    qty: 10,
    type: "receive",
    reason: "e2e",
  });
  if (e2) throw e2;
  return { eventId: event.id as string, today };
}

/** Switch the points programme on or off the way the owner does (it also refreshes its cache). */
async function setPoints(browser: Browser, on: boolean) {
  const owner = await browser.newPage();
  await signInAsOwner(owner);
  await owner.goto("/admin/loyalty/points");
  const toggle = owner.getByLabel(/Points & tiers are on/);
  if (on) await toggle.check();
  else await toggle.uncheck();
  await owner.getByRole("button", { name: "Save", exact: true }).click();
  await expect(owner.getByText("Points settings saved.")).toBeVisible();
  await owner.close();
}

test.describe("codes and points at the till", () => {
  test.describe.configure({ mode: "serial" });

  // The programme ships switched off; leave it that way for everything else.
  test.afterAll(async () => {
    await withLock("points", async () => {
      await adminClient().from("rewards_settings").update({ points_enabled: false }).eq("id", 1);
    });
  });

  test("an event code takes 10% off at that event's till", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop");
    const admin = adminClient();
    const stamp = `${info.project.name} ${Date.now()}`;
    const perfume = await createTestProduct(`till-code-${info.project.name}`, { stock: 0 });
    const { eventId } = await eventWithStock(`E2E till code ${stamp}`, perfume);
    const code = `E2ETILL${Date.now().toString().slice(-7)}`;
    const { error } = await admin.from("coupons").insert({
      code,
      kind: "percent",
      percent_bp: 1000,
      // "Works on: Event till", linked to this event (it works at that event only).
      channels: ["pos"],
      event_id: eventId,
      product_ids: [perfume.productId],
    });
    if (error) throw error;

    await signInAsOwner(page);
    await page.goto(`/admin/pos?event=${eventId}`);
    const tile = page.getByRole("button", { name: new RegExp(`^Add ${perfume.name}`) });
    await tile.click();
    await tile.click();
    await page.getByRole("button", { name: /^Charge/ }).click();
    const pay = page.getByRole("dialog");
    await expect(pay.getByRole("heading", { name: "AED 560" })).toBeVisible();

    await pay.getByRole("textbox", { name: "Discount code" }).fill(code.toLowerCase());
    await pay.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(pay.getByText(code, { exact: true })).toBeVisible();
    await expect(pay.getByText("−AED 56")).toBeVisible();
    await expect(pay.getByRole("heading", { name: "AED 504" })).toBeVisible();
    await pay.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: /SOL-\d+ · AED 504/ })).toBeVisible();

    const { data: orders } = await admin
      .from("orders")
      .select("channel, total_fils, coupon_code, applied_promotions")
      .eq("event_id", eventId);
    expect(orders).toHaveLength(1);
    expect(orders![0]).toMatchObject({ channel: "pos", total_fils: 50_400, coupon_code: code });
    expect(orders![0].applied_promotions).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "code", discount_fils: 5_600 })]),
    );

    // The same code isn't accepted at another event's till.
    const other = await eventWithStock(`E2E till other ${stamp}`, perfume);
    await page.goto(`/admin/pos?event=${other.eventId}`);
    await page.getByRole("button", { name: new RegExp(`^Add ${perfume.name}`) }).click();
    await page.getByRole("button", { name: /^Charge/ }).click();
    await page.getByRole("dialog").getByRole("textbox", { name: "Discount code" }).fill(code);
    await page.getByRole("dialog").getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "AED 280" })).toBeVisible();
  });

  test("a customer's points pay part of a till sale", async ({ page, browser }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop");
    test.setTimeout(300_000);
    const admin = adminClient();
    // The points switch is shop-wide: one test at a time across projects.
    await withLock("points", async () => {
      const stamp = `${info.project.name} ${Date.now()}`;
      const perfume = await createTestProduct(`till-points-${info.project.name}`, { stock: 0 });
      const { eventId } = await eventWithStock(`E2E till points ${stamp}`, perfume);

      await setPoints(browser, true);
      const { data: settings } = await admin
        .from("rewards_settings")
        .select("point_value_fils, min_redeem_points")
        .single();
      // Enough points to pass the minimum, worth well under the AED 280 sale.
      const points = Math.max(500, settings!.min_redeem_points);
      const valueFils = points * settings!.point_value_fils;
      expect(valueFils).toBeLessThan(28_000);

      const email = `till.points.e2e+${Date.now()}@solei.test`;
      const { data: customer, error } = await admin
        .from("customers")
        .insert({ name: `Till Points ${stamp}`, email })
        .select("id")
        .single();
      if (error) throw error;
      await admin
        .from("points_ledger")
        .insert({ customer_id: customer.id, entry: "adjust", points, note: "e2e" });

      await signInAsOwner(page);
      await page.goto(`/admin/pos?event=${eventId}`);
      await page.getByRole("button", { name: new RegExp(`^Add ${perfume.name}`) }).click();
      await page.getByRole("button", { name: /^Charge/ }).click();
      const pay = page.getByRole("dialog");
      await pay.getByRole("textbox", { name: "Customer email" }).fill(email);
      await expect(pay.getByText(`${points.toLocaleString("en-GB")} points`).first()).toBeVisible();
      const use = pay.getByRole("checkbox", {
        name: new RegExp(`^Use ${points.toLocaleString("en-GB")} points`),
      });
      await use.check();
      const due = formatAED(28_000 - valueFils);
      await expect(pay.getByRole("heading", { name: due })).toBeVisible();
      await pay.getByRole("button", { name: "Cash", exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: new RegExp(`SOL-\\d+ · ${due}`) }),
      ).toBeVisible();

      const { data: order } = await admin
        .from("orders")
        .select("id, channel, total_fils, customer_id")
        .eq("event_id", eventId)
        .single();
      expect(order).toMatchObject({ channel: "pos", total_fils: 28_000, customer_id: customer.id });
      const { data: spent } = await admin
        .from("points_ledger")
        .select("points")
        .eq("customer_id", customer.id)
        .eq("entry", "redeem")
        .eq("order_id", order!.id);
      expect(spent).toEqual([{ points: -points }]);

      await setPoints(browser, false);
    });
  });
});
