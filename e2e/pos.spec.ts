import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";

test.describe("event POS", () => {
  test("two perfumes, cash, in four taps — stock and totals update", async ({ page }, info) => {
    const admin = adminClient();
    const name = `POS e2e ${info.project.name} ${Date.now()}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    const { data: event } = await admin
      .from("events")
      .insert({ name, type: "popup", status: "confirmed", start_date: today, end_date: today })
      .select("id")
      .single();
    const { data: loc } = await admin
      .from("stock_locations")
      .select("id")
      .eq("event_id", event!.id)
      .single();
    const perfume = await createTestProduct(`pos-${info.project.name}`, { stock: 0 });
    await admin.from("stock_movements").insert({
      variant_id: perfume.variantId,
      location_id: loc!.id,
      qty: 10,
      type: "receive",
      reason: "e2e",
    });

    await signInAsOwner(page);
    await page.goto(`/admin/pos?event=${event!.id}`);
    const tile = page.getByRole("button", { name: new RegExp(`^Add ${perfume.name}`) });
    await tile.click();
    await tile.click();
    await page.getByRole("button", { name: /^Charge/ }).click();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: /SOL-\d+ · AED 560/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(`^Add ${perfume.name}.*8 left`) }),
    ).toBeVisible();

    const { data: orders } = await admin
      .from("orders")
      .select("event_day, channel, total_fils")
      .eq("event_id", event!.id);
    expect(orders).toHaveLength(1);
    expect(orders![0]).toMatchObject({ channel: "pos", event_day: today, total_fils: 56000 });
  });
});
