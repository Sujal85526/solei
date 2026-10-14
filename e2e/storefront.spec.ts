import { expect, test } from "@playwright/test";
import { adminClient } from "./helpers/auth";

test.describe("storefront — browse and cart", () => {
  test("shop → filter → product → add 2 → cart totals, delivery, qty, remove, persistence", async ({
    page,
  }) => {
    await page.goto("/shop");
    await expect(
      page.getByRole("heading", { level: 1, name: /Scents for every destination/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Mayfair All-over spray/ })).toBeVisible();

    // Filter by category, then sort by price (plain links — URL search params).
    // Phones open a side drawer from an icon; wider screens open the inline panel.
    const drawerToggle = page.getByRole("button", { name: "Filter & sort" });
    if (await drawerToggle.isVisible()) await drawerToggle.click();
    else await page.getByText("Filter", { exact: true }).click();
    const categories = page.getByRole("list", { name: "Category" });
    await categories.getByRole("link", { name: "Perfumes" }).click();
    await expect(page).toHaveURL(/category=perfume/);
    // Other suites may add throwaway products, so check membership rather than exact counts.
    await expect(page.getByRole("link", { name: /Cannes Perfume/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Mayfair All-over spray/ })).toHaveCount(0);
    if (await drawerToggle.isVisible()) await drawerToggle.click();
    await page.getByRole("link", { name: "Low to high" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();

    // Product page.
    await page.getByRole("link", { name: /Cannes Perfume/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cannes Perfume" })).toBeVisible();
    await expect(page.getByTestId("product-price")).toHaveText("AED 280");
    await expect(page.getByText("Price includes VAT")).toBeVisible();
    await expect(page.getByText(/Earn a Cannes stamp in your Solei Passport/)).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd!)).toMatchObject({ "@type": "Product", name: "Cannes Perfume" });

    const panel = page.getByTestId("purchase-panel");
    const add = panel.getByTestId("add-to-cart");
    await expect(add).toBeEnabled();
    await panel.getByRole("button", { name: "Increase quantity" }).click();
    await expect(panel.getByRole("group", { name: "Quantity" }).locator("output")).toHaveText("2");
    await add.click();

    const sheet = page.getByTestId("added-sheet");
    await expect(sheet.getByText("Added to your cart")).toBeVisible();
    await expect(sheet.getByText("2 items in your cart")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await sheet.getByRole("link", { name: "View cart" }).click();

    // Cart: 2 × AED 280 = AED 560, above the AED 500 free-delivery threshold.
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("summary-total")).toHaveText("AED 560");
    await expect(page.getByTestId("summary-delivery")).toHaveText("Free");
    await expect(page.getByText("You've unlocked free delivery.")).toBeVisible();
    await expect(page.getByTestId("summary-vat")).toHaveText("Includes AED 26.67 VAT");

    // Emirate selection → still free above the threshold.
    await page.getByTestId("emirate-select").selectOption("abu_dhabi");
    await expect(page.getByTestId("summary-delivery")).toHaveText("Free");

    // Down to 1 → the Abu Dhabi fee applies and the nudge appears.
    await page.getByTestId("cart-line").getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByTestId("summary-subtotal")).toHaveText("AED 280");
    await expect(page.getByTestId("summary-delivery")).toHaveText("AED 20");
    await expect(page.getByTestId("summary-total")).toHaveText("AED 300");
    await expect(page.getByText("AED 220 away from free delivery")).toBeVisible();

    // Dubai costs more.
    await page.getByTestId("emirate-select").selectOption("dubai");
    await expect(page.getByTestId("summary-total")).toHaveText("AED 305");

    // Persists across reload (lines and emirate).
    await page.reload();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("summary-total")).toHaveText("AED 305");
    await expect(page.getByTestId("emirate-select")).toHaveValue("dubai");
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    // Remove → empty state.
    await page.getByRole("button", { name: "Remove Cannes Perfume" }).click();
    await expect(page.getByTestId("cart-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore the collection" })).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });

  test("category and destination pages, and 404s for unknown slugs", async ({ page }) => {
    await page.goto("/shop/all_over_spray");
    await expect(page.getByRole("heading", { level: 1, name: "All-over sprays" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Soho All-over spray/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cannes Perfume/ })).toHaveCount(0);

    await page.goto("/destinations");
    await expect(page.locator('a[href^="/destinations/"]')).toHaveCount(8);
    await page.locator('a[href="/destinations/capri"]').click();
    await expect(page.getByRole("heading", { level: 1, name: "Capri" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Capri Perfume" })).toBeVisible();
    await expect(page).toHaveURL(/\/destinations\/capri$/);
    await page.waitForLoadState("networkidle");

    for (const path of ["/products/nope", "/destinations/nope", "/shop/nope"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });
});

test.describe("storefront — sold out", () => {
  let productId = "";
  let variantId = "";
  let slug = "";

  test.beforeAll(async ({}, info) => {
    // A throwaway product with no stock movements (0 available online). No destination, so
    // it never shows up in the destination filters other tests rely on.
    const db = adminClient();
    const tag = `${info.project.name}-${Date.now()}`;
    slug = `e2e-sold-out-${tag}`;
    const { data: category } = await db
      .from("categories")
      .select("id")
      .eq("slug", "perfume")
      .single();
    const { data: product, error } = await db
      .from("products")
      .insert({ category_id: category!.id, name: "E2E Sold Out", slug, sort: 999 })
      .select("id")
      .single();
    if (error) throw error;
    productId = product.id;
    const { data: variant, error: e2 } = await db
      .from("product_variants")
      .insert({
        product_id: productId,
        label: "50 ml",
        size_ml: 50,
        sku: `E2E-${tag}`,
        price_fils: 28_000,
      })
      .select("id")
      .single();
    if (e2) throw e2;
    variantId = variant.id;
  });

  test.afterAll(async () => {
    if (productId) await adminClient().from("products").delete().eq("id", productId);
  });

  test("disables add to cart and clears it from the cart", async ({ page }) => {
    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E Sold Out" })).toBeVisible();
    const add = page.getByTestId("add-to-cart");
    await expect(add).toBeDisabled();
    await expect(add).toHaveText(/Sold out/);

    // A stale cart line for the sold-out variant is removed with a gentle notice.
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          "solei.cart.v1",
          JSON.stringify({ v: 1, lines: [{ variantId: id, qty: 1 }], emirate: null }),
        ),
      variantId,
    );
    await page.goto("/cart");
    await expect(page.getByText("E2E Sold Out has just sold out")).toBeVisible();
    await expect(page.getByTestId("cart-empty")).toBeVisible();
  });
});
