import { expect, test, type Browser } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";

/** A giveaway product of its own for this run: AED 25, at least 20, with stock. */
async function giveawayProduct(tag: string) {
  const admin = adminClient();
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "perfume")
    .single();
  const slug = `e2e-giveaway-${tag}`;
  const { data: product, error } = await admin
    .from("products")
    .insert({
      slug,
      name: `E2E Giveaway ${tag}`,
      category_id: category!.id,
      active: true,
      min_order_qty: 20,
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await admin
    .from("product_variants")
    .insert({
      product_id: product!.id,
      sku: `E2E-GIVE-${tag}`,
      label: "10 ml",
      price_fils: 2500,
      active: true,
    })
    .select("id")
    .single();
  const { data: location } = await admin
    .from("stock_locations")
    .select("id")
    .eq("is_default", true)
    .single();
  await admin.from("stock_movements").insert({
    variant_id: variant!.id,
    location_id: location!.id,
    qty: 200,
    type: "receive",
    reason: "e2e",
  });
  return { productId: product!.id, variantId: variant!.id, slug };
}

/**
 * Rows inserted straight into the database skip the storefront's cached catalogue (the cart reads
 * it). Saving the product in Admin → Products refreshes it, as it does for the owner.
 */
async function refreshCatalogue(browser: Browser, productId: string) {
  const owner = await browser.newPage();
  await signInAsOwner(owner);
  await owner.goto(`/admin/products/${productId}`);
  await owner.getByRole("textbox", { name: "Minimum per order" }).fill("20");
  await owner.getByRole("textbox", { name: "Minimum per order" }).press("Enter");
  await expect(owner.getByText("Minimum saved.")).toBeVisible();
  await owner.close();
}

test.describe("giveaways customiser", () => {
  test("owner adds a choice with a price change in Admin → Products", async ({ page }, info) => {
    const { productId } = await giveawayProduct(
      `a${info.project.name.slice(0, 1)}${Date.now() % 1e7}`,
    );
    await signInAsOwner(page);
    await page.goto(`/admin/products/${productId}`);
    await page.getByRole("button", { name: "Add a choice" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Ribbon");
    await dialog.getByRole("textbox", { name: "Option" }).fill("Blush");
    await dialog.getByRole("button", { name: "Add option" }).click();
    await dialog.getByRole("textbox", { name: "Option" }).nth(1).fill("Gold");
    await dialog.getByRole("textbox", { name: "Price change (AED)" }).nth(1).fill("5");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Blush · Gold +AED 5")).toBeVisible();

    const { data } = await adminClient()
      .from("product_option_groups")
      .select("name, kind, product_options(label, price_delta_fils)")
      .eq("product_id", productId)
      .single();
    expect(data!.name).toBe("Ribbon");
    expect(data!.product_options.map((o) => o.price_delta_fils).sort()).toEqual([0, 500]);
  });

  test("a customer chooses options and buys 20; the order keeps the choices", async ({
    page,
    browser,
  }, info) => {
    // Sets up through the admin, then signs a customer in and checks out.
    test.setTimeout(90_000);
    const admin = adminClient();
    const { productId, slug } = await giveawayProduct(
      `b${info.project.name.slice(0, 1)}${Date.now() % 1e7}`,
    );
    const { data: ribbon } = await admin
      .from("product_option_groups")
      .insert({ product_id: productId, name: "Ribbon", kind: "single", required: true, sort: 0 })
      .select("id")
      .single();
    await admin.from("product_options").insert([
      { group_id: ribbon!.id, label: "Blush", price_delta_fils: 0, sort: 0 },
      { group_id: ribbon!.id, label: "Gold", price_delta_fils: 500, sort: 1 },
    ]);
    await admin.from("product_option_groups").insert({
      product_id: productId,
      name: "Names on the tag",
      kind: "text",
      required: true,
      max_length: 30,
      sort: 1,
    });
    await refreshCatalogue(browser, productId);

    const email = `giveaway.e2e+${Date.now()}@solei.test`;
    const password = "Solei-e2e-2026";
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Reem", last_name: "Test" },
    });
    if (error) throw error;

    await page.goto(`/products/${slug}`);
    // Adding without choosing explains what's missing.
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByText("Please choose “Ribbon”.")).toBeVisible();
    await page.getByText("Gold", { exact: false }).first().click();
    await page.getByRole("textbox", { name: "Names on the tag" }).fill("Sara & Omar");
    await expect(page.getByText("AED 30 each")).toBeVisible();
    await page.getByTestId("add-to-cart").click();
    await expect(
      page.getByText("Ribbon: Gold · Names on the tag: Sara & Omar").first(),
    ).toBeVisible();

    await page.goto("/checkout");
    await page.getByRole("button", { name: /already have an account/i }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await page.getByLabel("Mobile").fill(`050 ${String(Date.now()).slice(-7)}`);
    await page.getByLabel("Emirate").click();
    await page.getByRole("option", { name: "Abu Dhabi" }).click();
    await page.getByLabel("Street address").fill("Hall 3, Emirates Palace");
    await page.getByLabel("Area").fill("Ras Al Akhdar");
    await page.getByLabel("City").fill("Abu Dhabi");
    await page.getByRole("button", { name: /continue to payment/i }).click();
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Ribbon: Gold · Names on the tag: Sara & Omar")).toBeVisible();

    const { data: line } = await admin
      .from("order_lines")
      .select("qty, unit_price_fils, options, orders!inner(contact_email)")
      .eq("orders.contact_email", email)
      .single();
    expect(line!.qty).toBe(20);
    expect(line!.unit_price_fils).toBe(3000);
    expect(JSON.stringify(line!.options)).toContain("Sara & Omar");
  });
});
