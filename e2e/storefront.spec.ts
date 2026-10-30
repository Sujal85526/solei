import { expect, test } from "@playwright/test";
import { adminClient, settle } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";

/** An active product the shop lists in a category (from whatever catalogue the database has). */
async function listedProduct(category: string) {
  const { data } = await adminClient()
    .from("products")
    .select("name, categories!inner(slug), product_variants!inner(active)")
    .eq("active", true)
    .eq("categories.slug", category)
    .eq("product_variants.active", true)
    .not("name", "like", "E2E%")
    .not("name", "like", "QA%")
    .order("name")
    .limit(1)
    .single();
  return data!.name;
}

test.describe("storefront — browse and cart", () => {
  test("shop → filter → product → add 2 → cart totals, delivery, qty, remove, persistence", async ({
    page,
  }, info) => {
    const perfumeName = await listedProduct("perfume");
    const sprayName = await listedProduct("all_over_spray");
    const perfume = await createTestProduct(`store-${info.project.name}`, { destination: true });

    await page.goto("/shop");
    await expect(
      page.getByRole("heading", { level: 1, name: /Scents for every destination/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(sprayName) }).first()).toBeVisible();

    // Filter by category, then sort by price (plain links — URL search params).
    // Phones open a side drawer from an icon; wider screens open the inline panel.
    const drawerToggle = page.getByRole("button", { name: "Filter & sort" });
    if (await drawerToggle.isVisible()) await drawerToggle.click();
    else await page.getByText("Filter", { exact: true }).click();
    const categories = page.getByRole("list", { name: "Category" });
    await categories.getByRole("link", { name: "Perfumes" }).click();
    await expect(page).toHaveURL(/category=perfume/);
    // Other suites may add throwaway products, so check membership rather than exact counts.
    await expect(page.getByRole("link", { name: new RegExp(perfumeName) }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(sprayName) })).toHaveCount(0);
    if (await drawerToggle.isVisible()) await drawerToggle.click();
    await page.getByRole("link", { name: "Low to high" }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    // On phones choosing an option closes the drawer; "Clear filters" sits inside it.
    const phone = await drawerToggle.isVisible();
    if (phone) await drawerToggle.click();
    await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();
    if (phone) await page.keyboard.press("Escape");
    await page
      .getByRole("link", { name: new RegExp(perfumeName) })
      .first()
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settle(page);

    // Product page (the suite's own AED 280 perfume with a destination).
    await page.goto(`/products/${perfume.slug}`);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(perfume.destination!.name) }),
    ).toBeVisible();
    await expect(page.getByTestId("product-price")).toHaveText("AED 280");
    // The VAT note shows only while the business is VAT-registered (rate > 0 in settings).
    const { data: settings } = await adminClient()
      .from("settings")
      .select("vat_rate_bp, free_delivery_threshold_fils")
      .single();
    await expect(page.getByText("Price includes VAT")).toHaveCount(settings!.vat_rate_bp ? 1 : 0);
    await page.getByText("Details", { exact: true }).click();
    await expect(
      page.getByText(`Earn a ${perfume.destination!.name} stamp in your Solei Passport`),
    ).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd!)).toMatchObject({ "@type": "Product", name: perfume.name });

    const panel = page.getByTestId("purchase-panel");
    const add = panel.getByTestId("add-to-cart");
    await expect(add).toHaveText(/Add to cart/);
    // Adding opens the cart drawer (the only cart — there is no cart page).
    await add.click();
    const drawer = page.getByRole("dialog", { name: /Your Cart/ });
    await expect(drawer.getByTestId("drawer-line")).toHaveCount(1);
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByTestId("cart-count")).toHaveText("2");
    await expect(drawer.getByTestId("drawer-subtotal")).toHaveText("AED 560");
    // The free-delivery nudge shows only while the owner sets a threshold (none today: D3).
    const threshold = settings!.free_delivery_threshold_fils;
    if (threshold === null) {
      await expect(drawer.getByRole("progressbar")).toHaveCount(0);
      await drawer.getByRole("button", { name: "Decrease quantity" }).click();
      await expect(drawer.getByTestId("drawer-subtotal")).toHaveText("AED 280");
    } else {
      await expect(
        drawer.getByText(
          threshold <= 56_000 ? "You've unlocked free delivery." : /away from free delivery/,
        ),
      ).toBeVisible();
      await drawer.getByRole("button", { name: "Decrease quantity" }).click();
      await expect(drawer.getByTestId("drawer-subtotal")).toHaveText("AED 280");
      if (threshold > 28_000)
        await expect(drawer.getByText(`AED ${(threshold - 28_000) / 100}`)).toBeVisible();
    }

    // Persists across reload; the header bag reopens the drawer.
    await page.reload();
    await expect(page.getByTestId("cart-count")).toHaveText("1");
    await page.getByRole("button", { name: /Cart$/ }).click();
    await expect(drawer.getByTestId("drawer-line")).toHaveCount(1);

    // Remove → empty state.
    await drawer.getByRole("button", { name: `Remove ${perfume.name}` }).click();
    await expect(drawer.getByText("Your cart is empty")).toBeVisible();
    await expect(page.getByTestId("cart-count")).toHaveText("0");
  });

  test("category pages, removed destination pages redirect, and 404s for unknown slugs", async ({
    page,
  }) => {
    const sprayName = await listedProduct("all_over_spray");
    const perfumeName = await listedProduct("perfume");
    await page.goto("/shop/all_over_spray");
    await expect(page.getByRole("heading", { level: 1, name: "All-over sprays" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(sprayName) }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(perfumeName) })).toHaveCount(0);

    const { data: destination } = await adminClient()
      .from("destinations")
      .select("slug")
      .limit(1)
      .single();
    await page.goto(`/destinations/${destination!.slug}`);
    await expect(page).toHaveURL(/\/shop$/);

    for (const path of ["/products/nope", "/shop/nope"]) {
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
    // While the availability streams in, the "Checking availability…" fallback can still be in the
    // DOM next to the real panel.
    const add = page.getByTestId("add-to-cart").filter({ hasText: "Sold out" });
    await expect(add).toBeDisabled();

    // A stale cart line for the sold-out variant is removed with a gentle notice.
    await page.evaluate(
      (id) =>
        localStorage.setItem(
          "solei.cart.v1",
          JSON.stringify({ v: 1, lines: [{ variantId: id, qty: 1 }], emirate: null }),
        ),
      variantId,
    );
    await page.reload();
    await page.getByRole("button", { name: /Cart$/ }).click();
    await expect(page.getByText("E2E Sold Out has just sold out")).toBeVisible();
  });
});
