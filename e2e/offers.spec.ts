import { expect, test, type Page } from "@playwright/test";
import { adminClient, settle, signInAsOwner } from "./helpers/auth";
import { createTestProduct, type TestProduct } from "./helpers/catalog";

/*
 * Automatic offers (Admin → Promotions → Offers, P2-61/P2-63) and a combinable code on top.
 * Every offer and code is scoped to products this suite creates, so whatever else the test
 * database holds (live data, other suites) is untouched. Sale prices on product pages come from a
 * cached list that only an admin save refreshes, so the sale is created through the admin UI.
 */

type Order = {
  total_fils: number;
  delivery_fee_fils: number;
  delivery_discount_fils: number;
  coupon_code: string | null;
  applied_promotions: { type: string; kind: string; discount_fils: number; times?: number }[];
};

/** A verified storefront account (checkout requires one), created directly for the test. */
async function customerAccount(tag: string) {
  const email = `offers.${tag}.e2e+${Date.now()}@solei.test`;
  const password = "Solei-e2e-2026";
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Offer", last_name: "Test" },
  });
  if (error) throw error;
  return { email, password };
}

/** Product page → Add to cart (opens the bag drawer); `qty` > 1 is set in the drawer. */
async function addToBag(page: Page, product: TestProduct, qty = 1) {
  await page.goto(`/products/${product.slug}`);
  await page.getByTestId("purchase-panel").last().getByTestId("add-to-cart").click();
  const line = page
    .getByRole("dialog", { name: /Your Cart/ })
    .getByTestId("drawer-line")
    .filter({ hasText: product.name });
  await expect(line).toBeVisible();
  for (let i = 1; i < qty; i++)
    await line.getByRole("button", { name: "Increase quantity" }).click();
  await settle(page);
}

/** Signed-out checkout: sign in, fill the delivery form; leaves the summary open on phones. */
async function checkout(page: Page, account: { email: string; password: string }) {
  await page.goto("/checkout");
  await page.getByRole("button", { name: /already have an account/i }).click();
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(`Signed in as ${account.email}`)).toBeVisible();
  // A fresh number each run: orders match customers by phone first.
  await page.getByLabel("Mobile").fill(`050 ${String(Date.now()).slice(-7)}`);
  await page.getByLabel("Emirate").click();
  await page.getByRole("option", { name: "Abu Dhabi" }).click();
  await page.getByLabel("Street address").fill("Villa 11, Street 6");
  await page.getByLabel("Area").fill("Al Bateen");
  await page.getByLabel("City").fill("Abu Dhabi");
  // Phones and tablets fold the summary above the form; open it and use the visible one.
  const fold = page.getByText("Show order summary");
  if (await fold.isVisible()) await fold.click();
}

async function payByTestCard(page: Page) {
  await page.getByRole("checkbox", { name: /I agree to the/i }).check();
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await expect(page.getByText("Test payment · no real card")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Pay with test card" }).click();
  await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
    timeout: 20_000,
  });
}

async function orderFor(email: string) {
  const { data, error } = await adminClient()
    .from("orders")
    .select(
      "total_fils, delivery_fee_fils, delivery_discount_fils, coupon_code, applied_promotions",
    )
    .eq("contact_email", email)
    .single();
  if (error) throw error;
  return data as unknown as Order;
}

const promo = (order: Order, kind: string, type?: string) =>
  order.applied_promotions.find((p) => p.kind === kind && (!type || p.type === type));

test.describe("automatic offers", () => {
  test.describe.configure({ mode: "serial" });

  let sale: TestProduct; // 25% off (sale price)
  let perfume: TestProduct; // bundle item 1
  let spray: TestProduct; // bundle item 2
  let candle: TestProduct; // buy 2 get 1 free
  let stamp = "";
  const offerIds: string[] = [];
  const codes: string[] = [];

  test.beforeAll(async ({}, info) => {
    stamp = `${info.project.name}-${Date.now()}`;
    [sale, perfume, spray, candle] = await Promise.all([
      createTestProduct(`offer-sale-${info.project.name}`),
      createTestProduct(`offer-perfume-${info.project.name}`),
      createTestProduct(`offer-spray-${info.project.name}`, { priceFils: 15_000 }),
      createTestProduct(`offer-bxgy-${info.project.name}`, { priceFils: 10_000 }),
    ]);
  });

  test.afterAll(async () => {
    const admin = adminClient();
    // Orders keep the offers in their snapshot; switching off is enough to stop them applying.
    if (offerIds.length) await admin.from("offers").update({ active: false }).in("id", offerIds);
    if (codes.length) await admin.from("coupons").update({ active: false }).in("code", codes);
    await admin
      .from("products")
      .update({ active: false })
      .in(
        "id",
        [sale, perfume, spray, candle].filter(Boolean).map((p) => p.productId),
      );
  });

  test("owner puts one product on sale in Admin → Promotions; the shop shows was/now", async ({
    page,
  }) => {
    const name = `E2E sale ${stamp}`;
    await signInAsOwner(page);
    await page.goto("/admin/promotions/offers/new");
    await expect(page.getByRole("heading", { level: 1, name: "New offer" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Sale price/ })).toBeChecked();
    await page.getByRole("textbox", { name: /^Name/ }).fill(name);
    await page.getByRole("textbox", { name: /^Percentage/ }).fill("25");
    await page.getByRole("checkbox", { name: /Only for certain categories or products/ }).check();
    await page
      .getByRole("group", { name: "Products" })
      .getByRole("checkbox", { name: sale.name, exact: true })
      .check();
    await page.getByRole("button", { name: "Create offer" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("25% off").first()).toBeVisible();

    const { data: offer } = await adminClient()
      .from("offers")
      .select("id, kind, percent_bp, product_ids, channels")
      .eq("name", name)
      .single();
    offerIds.push(offer!.id);
    expect(offer).toMatchObject({ kind: "sale", percent_bp: 2500, product_ids: [sale.productId] });

    // AED 280 → AED 210, the old price struck through.
    await page.goto(`/products/${sale.slug}`);
    // The price streams in after a plain fallback; both can be in the page for a moment.
    const price = page.getByTestId("product-price").filter({ hasText: "AED 210" });
    await expect(price).toContainText("AED 210");
    await expect(price.locator("s")).toHaveText("AED 280");
    await expect(price).toContainText(name);
  });

  test("a bundle (made in the admin) and buy 2 get 1 free apply by themselves in the bag", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const bundleName = `E2E bundle ${stamp}`;
    const bxgyName = `E2E 3 for 2 ${stamp}`;

    // Bundle: the perfume + the spray for AED 350 (instead of 280 + 150), through the form.
    const owner = await browser.newPage();
    await signInAsOwner(owner);
    await owner.goto("/admin/promotions/offers/new");
    await owner.getByRole("radio", { name: /^Bundle/ }).check();
    await owner.getByRole("textbox", { name: /^Name/ }).fill(bundleName);
    await expect(owner.getByRole("radio", { name: /Price for the whole set/ })).toBeChecked();
    await owner.getByRole("textbox", { name: /^Amount in AED/ }).fill("350");
    for (const [i, product, label] of [
      [1, perfume, "Perfume"],
      [2, spray, "Spray"],
    ] as const) {
      const slot = owner
        .getByRole("listitem")
        .filter({ has: owner.getByRole("button", { name: `Remove item ${i}` }) });
      await slot.getByRole("textbox", { name: /^Label/ }).fill(label);
      await slot
        .getByRole("group", { name: "Products" })
        .getByRole("checkbox", { name: product.name, exact: true })
        .check();
    }
    await owner.getByRole("button", { name: "Create offer" }).click();
    await expect(owner.getByRole("heading", { level: 1, name: bundleName })).toBeVisible();
    await expect(owner.getByText("AED 350 for the set").first()).toBeVisible();
    await owner.close();

    // Buy 2 get 1 free on the AED 100 item, straight in the database (the bag always asks it).
    const admin = adminClient();
    const { data: bxgy, error } = await admin
      .from("offers")
      .insert({
        name: bxgyName,
        kind: "buy_x_get_y",
        percent_bp: 10_000,
        buy_qty: 2,
        get_qty: 1,
        product_ids: [candle.productId],
        channels: ["website"],
      })
      .select("id")
      .single();
    if (error) throw error;
    const { data: bundle } = await admin
      .from("offers")
      .select("id, kind, bundle_price_fils, slots")
      .eq("name", bundleName)
      .single();
    offerIds.push(bxgy.id, bundle!.id);
    expect(bundle).toMatchObject({ kind: "bundle", bundle_price_fils: 35_000 });

    // Bag: perfume + spray (bundle, −AED 80) and 3 × AED 100 (one free, −AED 100).
    await addToBag(page, perfume);
    await addToBag(page, spray);
    await addToBag(page, candle, 3);
    const account = await customerAccount(`bundle-${stamp}`);
    await checkout(page, account);
    await expect(page.getByText(bundleName).locator("visible=true").first()).toBeVisible();
    await expect(page.getByText(bxgyName).locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("−AED 80").locator("visible=true").first()).toBeVisible();
    await expect(page.getByText("−AED 100").locator("visible=true").first()).toBeVisible();
    await payByTestCard(page);

    const order = await orderFor(account.email);
    expect(promo(order, "bundle")).toMatchObject({ type: "offer", discount_fils: 8_000, times: 1 });
    expect(promo(order, "buy_x_get_y")).toMatchObject({ type: "offer", discount_fils: 10_000 });
    // 280 + 150 + 3 × 100 = 730, less 80 and 100, plus delivery.
    expect(order.total_fils).toBe(55_000 + order.delivery_fee_fils - order.delivery_discount_fils);
  });

  test("a combinable code takes 10% more off a sale item at checkout", async ({ page }) => {
    test.setTimeout(90_000);
    const code = `E2EMIX${Date.now().toString().slice(-7)}`;
    const { error } = await adminClient()
      .from("coupons")
      .insert({
        code,
        kind: "percent",
        percent_bp: 1000,
        combinable: true,
        product_ids: [sale.productId],
        channels: ["website"],
      });
    if (error) throw error;
    codes.push(code);

    await addToBag(page, sale);
    const account = await customerAccount(`code-${stamp}`);
    await checkout(page, account);
    await page.getByRole("textbox", { name: "Discount code" }).locator("visible=true").fill(code);
    // The first Apply is the discount code (the second is the gift card).
    await page.getByRole("button", { name: "Apply" }).locator("visible=true").first().click();
    await expect(page.getByText(code).locator("visible=true").first()).toBeVisible();
    // Sale price AED 210, then 10% of it: −AED 21.
    await expect(page.getByText("−AED 21").locator("visible=true").first()).toBeVisible();
    await payByTestCard(page);

    const order = await orderFor(account.email);
    expect(order.coupon_code).toBe(code);
    expect(promo(order, "sale", "sale")).toMatchObject({ discount_fils: 7_000 });
    expect(promo(order, "percent", "code")).toMatchObject({ discount_fils: 2_100 });
    expect(order.total_fils).toBe(18_900 + order.delivery_fee_fils - order.delivery_discount_fils);
  });
});
