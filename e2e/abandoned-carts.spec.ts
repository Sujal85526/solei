import { createHash, createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { localEnv } from "./helpers/env";
import { createTestProduct } from "./helpers/catalog";

/** Same signing as src/modules/carts/links.ts with the derived secret. */
const cartLinkSecret = () =>
  localEnv().CART_LINK_SECRET ||
  createHash("sha256").update(`cart-links:${localEnv().SUPABASE_SECRET_KEY}`).digest("hex");
const token = (id: string, purpose: "restore" | "optout") =>
  createHmac("sha256", cartLinkSecret()).update(`cart:${purpose}:${id}`).digest("hex").slice(0, 32);

test.describe("abandoned carts", () => {
  test.describe.configure({ mode: "serial" });

  test("a signed-in bag is saved, reminded, restored from the email and can be turned off", async ({
    page,
    browser,
  }) => {
    const admin = adminClient();
    const email = `bag.e2e+${Date.now()}@solei.test`;
    const password = "Solei-e2e-2026";
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Huda", last_name: "Test" },
    });
    if (error) throw error;
    const perfume = await createTestProduct("bag");

    // Sign in at checkout with a perfume in the bag → the bag is saved.
    await page.goto(`/products/${perfume.slug}`);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.goto("/checkout");
    await page.getByRole("button", { name: /already have an account/i }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    let cartId = "";
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("carts")
          .select("id, item_count")
          .eq("user_id", created.user.id)
          .eq("status", "open")
          .maybeSingle();
        cartId = data?.id ?? "";
        return data?.item_count ?? 0;
      })
      .toBe(1);

    // Five hours later… the owner sends the due reminders.
    await admin
      .from("carts")
      .update({ updated_at: new Date(Date.now() - 5 * 3_600_000).toISOString() })
      .eq("id", cartId);
    const staff = await browser.newPage();
    await signInAsOwner(staff);
    await staff.goto("/admin/carts");
    await expect(staff.getByText(email)).toBeVisible();
    await staff.getByRole("button", { name: "Send due reminders now" }).click();
    await expect(staff.getByText(/reminders? sent/)).toBeVisible();
    const { data: log } = await admin
      .from("notification_log")
      .select("template_key, status")
      .eq("recipient", email);
    expect(log).toContainEqual({ template_key: "cart_reminder", status: "sent" });
    await staff.close();

    // "Return to your bag" on another device (empty bag) → checkout with the perfume.
    const other = await browser.newPage();
    await other.goto(`/cart/restore?c=${cartId}&t=${token(cartId, "restore")}`);
    await other.waitForURL("**/checkout");
    const restored = await other.evaluate(() => localStorage.getItem("solei.cart.v1") ?? "");
    expect(restored).toContain(perfume.variantId);

    // "Turn them off".
    await other.goto(`/cart/stop?c=${cartId}&t=${token(cartId, "optout")}`);
    await other.getByRole("button", { name: "Turn off bag reminders" }).click();
    await expect(other.getByRole("heading", { name: "Reminders are off." })).toBeVisible();
    const { data: optout } = await admin
      .from("cart_reminder_optouts")
      .select("user_id")
      .eq("user_id", created.user.id)
      .maybeSingle();
    expect(optout).not.toBeNull();

    // A forged link does nothing.
    await other.goto(`/cart/restore?c=${cartId}&t=${"0".repeat(32)}`);
    await expect(other.getByText("This link isn't valid any more.")).toBeVisible();
    await other.close();
  });
});
