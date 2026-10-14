import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner, signInAsSales } from "./helpers/auth";

// 1×1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("catalog & inventory admin", () => {
  test("owner creates a product with a variant, photo and stock, then adjusts and transfers it", async ({
    page,
  }, info) => {
    test.slow();
    const stamp = `${info.project.name}-${Date.now()}`;
    const name = `E2E Scent ${stamp}`;
    const sku = `E2E-${info.project.name.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    await signInAsOwner(page);
    await page.goto("/admin/products/new");
    await page.getByLabel("Product name").fill(name);
    await page.getByLabel("Category").selectOption({ label: "Perfumes" });
    await page.getByLabel("Destination").selectOption({ label: "Capri" });
    await page.getByLabel("Top notes").fill("Lemon, Neroli");
    await page.getByRole("button", { name: "Create product" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    // Variant with price + cost
    await page.getByRole("button", { name: "Add variant" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Size (ml)").fill("50");
    await dialog.getByLabel("SKU").fill(sku);
    await dialog.getByLabel("Price (AED, incl. VAT)").fill("295");
    await dialog.getByLabel("Unit cost (AED)").fill("95.50");
    await dialog.getByRole("button", { name: "Save variant" }).click();
    await expect(page.getByText("AED 295")).toBeVisible();
    await expect(page.getByText("cost AED 95.50")).toBeVisible();

    // Photo upload to Storage
    await page
      .getByTestId("image-upload")
      .setInputFiles({ name: "bottle.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Cover")).toBeVisible();

    // Receive 100 from the variant's stock page
    await page.getByRole("link", { name: "0 in stock" }).click();
    await expect(page.getByText("Total on hand")).toBeVisible();
    await page.getByRole("button", { name: "Receive" }).click();
    let form = page.getByRole("dialog");
    await form.getByLabel("Units").fill("100");
    await form.getByRole("button", { name: "Receive" }).click();
    await expect(page.getByText("Stock received.")).toBeVisible();

    // Damage needs a reason
    await page.getByRole("button", { name: "Damage / correction" }).click();
    form = page.getByRole("dialog");
    await form.getByLabel("Units").fill("2");
    await form.getByRole("button", { name: "Save adjustment" }).click();
    await expect(form.getByText(/Say why/)).toBeVisible();
    await form.getByLabel("Reason").fill("Broken in transit");
    await form.getByRole("button", { name: "Save adjustment" }).click();
    await expect(page.getByText("Stock adjusted.")).toBeVisible();

    // Transfer to a second location, created through the admin client.
    const locName = `E2E store ${stamp}`;
    await adminClient().from("stock_locations").insert({ name: locName, kind: "warehouse" });
    await page.reload();
    await page.getByRole("button", { name: "Transfer" }).click();
    form = page.getByRole("dialog");
    await form.getByLabel("To").selectOption({ label: locName });
    await form.getByLabel("Units").fill("10");
    await form.getByRole("button", { name: "Transfer" }).click();
    await expect(page.getByText("Stock transferred.")).toBeVisible();

    // Ledger: 100 − 2 = 98 total, 88 in main, 10 in the new location; history shows each movement.
    await page.reload();
    await expect(page.getByText("Total on hand").locator("..").getByText("98")).toBeVisible();
    await expect(page.getByText("Main stock").locator("..").getByText("88")).toBeVisible();
    await expect(page.getByText(locName).locator("..").getByText("10")).toBeVisible();
    await expect(page.getByText("Broken in transit")).toBeVisible();
    await expect(page.getByText("Transferred out")).toBeVisible();
  });

  test("transfers can't exceed stock", async ({ page }, info) => {
    const locName = `E2E overflow ${info.project.name}-${Date.now()}`;
    await adminClient().from("stock_locations").insert({ name: locName, kind: "warehouse" });
    await signInAsOwner(page);
    await page.goto("/admin/inventory");
    await page.getByRole("button", { name: "Transfer" }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Product").selectOption({ index: 1 });
    await form.getByLabel("To").selectOption({ label: locName });
    await form.getByLabel("Units").fill("99999");
    await form.getByRole("button", { name: "Transfer" }).click();
    await expect(page.getByText(/Not enough stock/i)).toBeVisible();
  });

  test("sales staff see stock but can't change it or see costs", async ({ page }) => {
    await signInAsSales(page);
    await page.goto("/admin/inventory");
    await expect(page.getByText("Units in stock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Receive" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Damage / correction" })).toHaveCount(0);
    await page.goto("/admin/products");
    await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
    await page
      .getByRole("link", { name: /Capri Perfume/ })
      .first()
      .click();
    await expect(page.getByText(/cost AED/)).toHaveCount(0);
  });
});
