import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test("shows the hero slider, its controls and every section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /A destination in every scent/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /^Shop now/ }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Pause slideshow|Play slideshow/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(page.getByText("02", { exact: false }).first()).toBeVisible();
    for (const name of [
      /Signature Scents/,
      /Scents are memories in another form/,
      /Different places/,
      /Bring Solei/,
      /Collect the destinations/,
      /More than a fragrance/,
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
  });

  test("the event service is obvious from the homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('a[href="/events"]').first()).toBeAttached();
    await expect(page.getByRole("link", { name: /Plan your event/ }).first()).toBeAttached();
  });

  test("lists all eight destinations and the catalogue from the database", async ({ page }) => {
    await page.goto("/");
    // The ticker renders the list twice for a seamless loop; the copy is aria-hidden.
    const index = page.getByRole("region", { name: "Destinations" });
    for (const d of [
      "cannes",
      "marbella",
      "verona",
      "capri",
      "santorini",
      "soho",
      "monaco",
      "mayfair",
    ]) {
      await expect(index.locator(`a[href="/destinations/${d}"]`)).toHaveCount(2);
    }
    const rail = page.getByRole("region", { name: "Signature scents" });
    await expect(rail.getByText("AED 280").first()).toBeAttached();
  });

  test("quick add puts a scent in the cart", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /^Add .* to cart$/ })
      .first()
      .click();
    await expect(page.getByTestId("cart-count")).toHaveText("(1)");
  });

  test("early-access sign-up requires consent", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("section[aria-labelledby=experience-title]");
    await section.getByLabel("Email").fill(`early.${Date.now()}@solei.test`);
    await section.getByRole("button", { name: "Sign up" }).click();
    await expect(section.getByText(/tick the box/)).toBeVisible();
    await section.getByRole("checkbox").check();
    await section.getByRole("button", { name: "Sign up" }).click();
    await expect(section.getByText("You're on the list.")).toBeVisible();
  });
});
