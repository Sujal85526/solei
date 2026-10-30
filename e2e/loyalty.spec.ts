import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";

/** A customer with one unpaid WhatsApp order for 1 × a destination perfume (service role). */
async function seedCustomerWithOrder(tag: string) {
  const admin = adminClient();
  const n = String(Date.now() % 10_000_000).padStart(7, "0");
  const { data: customer, error } = await admin
    .from("customers")
    .insert({
      name: `Loyalty ${tag}`,
      phone: `+97156${n}`,
      email: `loyalty.${tag}.${n}@example.com`,
      source: "whatsapp",
    })
    .select("id")
    .single();
  if (error) throw error;
  const perfume = await createTestProduct(`loyalty-${tag}`, { destination: true });
  const { data: variant } = await admin
    .from("product_variants")
    .select("id, sku, label, price_fils, products(name, category_id, destination_id)")
    .eq("id", perfume.variantId)
    .single();
  const product = variant!.products as unknown as {
    name: string;
    category_id: string;
    destination_id: string;
  };
  const { data: order, error: e2 } = await admin
    .from("orders")
    .insert({
      customer_id: customer.id,
      channel: "whatsapp",
      status: "new",
      subtotal_fils: variant!.price_fils,
      total_fils: variant!.price_fils,
      contact_name: `Loyalty ${tag}`,
    })
    .select("id")
    .single();
  if (e2) throw e2;
  const { error: e3 } = await admin.from("order_lines").insert({
    order_id: order.id,
    variant_id: variant!.id,
    product_name: product.name,
    variant_label: variant!.label,
    sku: variant!.sku,
    category_id: product.category_id,
    destination_id: product.destination_id,
    qty: 1,
    list_price_fils: variant!.price_fils,
    unit_price_fils: variant!.price_fils,
    line_total_fils: variant!.price_fils,
  });
  if (e3) throw e3;
  return { customerId: customer.id, orderId: order.id, destination: perfume.destination!.name };
}

test.describe("Solei Passport", () => {
  test("paid order stamps the passport, manual stamps unlock a reward, staff redeem it", async ({
    page,
  }, info) => {
    const { customerId, orderId, destination } = await seedCustomerWithOrder(info.project.name);
    await signInAsOwner(page);

    // Paying the order awards the stamp (after_order_paid).
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("The order is fully paid")).toBeVisible();

    await page.goto(`/admin/customers/${customerId}`);
    const panel = page.getByTestId("passport-panel");
    await expect(panel.getByTestId("passport-progress")).toHaveText("1 / 12");
    await expect(panel.getByText(destination, { exact: true })).toBeVisible();

    // +11 by hand (reason required) → 12 → reward unlocks, card restarts.
    await panel.getByRole("button", { name: "Adjust stamps" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Stamps").fill("11");
    await dialog.getByLabel(/Reason/).fill("Paper passport from a pop-up");
    await dialog.getByRole("button", { name: "Add stamps" }).click();
    await expect(page.getByText("Stamps updated.")).toBeVisible();
    await expect(panel.getByTestId("passport-progress")).toHaveText("0 / 12");
    await expect(panel.getByText("Available", { exact: true })).toBeVisible();

    // Redeem → zero-priced order.
    await panel.getByRole("button", { name: "Redeem" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Redeem reward" }).click();
    // The dialog closes and the reward is marked as used on the new order.
    await expect(panel.getByText(/used on SOL-\d+/)).toBeVisible();
    await expect(panel.getByText("Redeemed", { exact: true })).toBeVisible();
  });

  test("passport page explains the programme and offers account sign-in", async ({ page }) => {
    await page.goto("/passport");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every scent takes");
    await expect(page.getByRole("heading", { name: "Collect 12 stickers" })).toBeVisible();
    const tracker = page.locator("#your-passport");
    await expect(tracker.getByTestId("passport-progress")).toContainText("0 / 12");
    await tracker.getByRole("button", { name: /Sign in to view progress/ }).click();
    // Sign-in opens in the account drawer; close it to read the FAQ.
    const signIn = page.getByRole("dialog");
    await expect(signIn.getByLabel("Email address")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(signIn).toHaveCount(0);
    await page.getByText("Which purchases earn a sticker?").click();
    await expect(page.getByText(/one destination sticker per item/)).toBeVisible();
  });
});
