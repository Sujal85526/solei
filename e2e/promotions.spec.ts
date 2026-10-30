import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";

/** A verified storefront account (checkout requires one), created directly for the test. */
async function customerAccount() {
  const email = `promo.e2e+${Date.now()}@solei.test`;
  const password = "Solei-e2e-2026";
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Promo", last_name: "Test" },
  });
  if (error) throw error;
  return { email, password };
}

test.describe("promotions", () => {
  test("owner creates a free-delivery code in Admin → Promotions", async ({ page }) => {
    const code = `SHIP${Date.now().toString().slice(-6)}`;
    await signInAsOwner(page);
    await page.goto("/admin/promotions");
    await expect(page.getByRole("heading", { name: "Promotions" })).toBeVisible();
    await page.getByRole("link", { name: /new promotion/i }).click();
    await page.getByRole("textbox", { name: /^Code/ }).fill(code.toLowerCase());
    await page.getByLabel("Free delivery").check();
    await page.getByLabel("Uses per customer").fill("1");
    await page.getByRole("button", { name: "Create promotion" }).click();
    await expect(page.getByRole("heading", { name: code })).toBeVisible();
    await expect(page.getByText("Promotions · Free delivery")).toBeVisible();

    const { data } = await adminClient()
      .from("coupons")
      .select("kind, per_customer_limit")
      .eq("code", code)
      .single();
    expect(data).toEqual({ kind: "free_delivery", per_customer_limit: 1 });
  });

  test("a free-delivery code at checkout waives the fee and is stored on the order", async ({
    page,
  }) => {
    const code = `FREESHIP${Date.now().toString().slice(-6)}`;
    const admin = adminClient();
    const { error } = await admin
      .from("coupons")
      .insert({ code, kind: "free_delivery", per_customer_limit: 1 });
    if (error) throw error;
    const account = await customerAccount();
    const perfume = await createTestProduct("freeship");

    await page.goto(`/products/${perfume.slug}`);
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.goto("/checkout");
    await page.getByRole("button", { name: /already have an account/i }).click();
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(`Signed in as ${account.email}`)).toBeVisible();
    await page.getByLabel("Mobile").fill("050 333 4455");
    await page.getByLabel("Emirate").click();
    await page.getByRole("option", { name: "Abu Dhabi" }).click();
    await page.getByLabel("Street address").fill("Villa 3, Street 9");
    await page.getByLabel("Area").fill("Al Bateen");
    await page.getByLabel("City").fill("Abu Dhabi");

    // Phones and tablets fold the summary above the form; open it and use the visible one.
    const fold = page.getByText("Show order summary");
    if (await fold.isVisible()) await fold.click();
    const box = page.getByRole("textbox", { name: "Discount code" }).locator("visible=true");
    await box.fill(code);
    // The first Apply is the discount code (the second is the gift card).
    await page.getByRole("button", { name: "Apply" }).locator("visible=true").first().click();
    await expect(page.getByText(code).locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("AED 30").locator("visible=true").first()).toBeVisible(); // struck through

    await page.getByRole("checkbox", { name: /I agree to the/i }).check();

    await page.getByRole("button", { name: /continue to payment/i }).click();
    await expect(page.getByText("Test payment · no real card")).toBeVisible();
    await expect(page.getByText("AED 280")).toBeVisible(); // goods only, delivery waived
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });

    const { data: order } = await admin
      .from("orders")
      .select(
        "coupon_code, delivery_fee_fils, delivery_discount_fils, total_fils, applied_promotions",
      )
      .eq("contact_email", account.email)
      .single();
    expect(order).toMatchObject({
      coupon_code: code,
      delivery_fee_fils: 0,
      delivery_discount_fils: 3000,
      total_fils: 28000,
    });
    expect((order!.applied_promotions as { kind: string }[])[0].kind).toBe("free_delivery");
  });
});
