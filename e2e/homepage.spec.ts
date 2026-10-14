import { expect, test } from "@playwright/test";

test.describe("homepage", () => {
  test("shows hero, both CTAs and every section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /A destination in scent/ }),
    ).toBeVisible();
    const hero = page.locator("section").first();
    await expect(hero.getByRole("link", { name: "Shop the collection" })).toBeVisible();
    await expect(hero.getByRole("link", { name: "Plan your event" })).toBeVisible();
    for (const name of [
      /Eight places/,
      /Designed as a/,
      /Bring Solei/,
      /Collect the destinations/,
      /Inspired by destinations/,
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
  });

  test("lists all eight destinations linking to their pages", async ({ page }) => {
    await page.goto("/");
    const list = page.locator("section[aria-labelledby=destinations-title] ul");
    await expect(list.getByRole("listitem")).toHaveCount(8);
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
      await expect(list.locator(`a[href="/destinations/${d}"]`)).toHaveCount(1);
    }
    await expect(page.getByText("AED 280").first()).toBeVisible();
  });

  test("passport band reads the reward rule", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/12\s*stamps = a free all-over spray/)).toBeVisible();
  });

  test("opt-in requires consent and accepts a UAE WhatsApp number", async ({ page }) => {
    await page.goto("/");
    const form = page.locator("section[aria-labelledby=optin-title]");
    await form.getByText("WhatsApp", { exact: true }).click();
    await form.getByLabel("WhatsApp number").fill("050 123 4567");
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(form.getByText(/tick the box/)).toBeVisible();
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Subscribe" }).click();
    await expect(form.getByText(/first postcard is on its way/)).toBeVisible();
  });
});
