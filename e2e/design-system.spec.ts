import { expect, test } from "@playwright/test";
import { signInAsSales } from "./helpers/auth";

test("styleguide shows tokens and motifs", async ({ page }) => {
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { name: "Solei styleguide" })).toBeVisible();
  await expect(page.getByText("#460328")).toBeVisible();
  await expect(page.getByRole("img", { name: "Solei" }).first()).toBeVisible();
});

test("store header navigation adapts to the viewport", async ({ page, isMobile }) => {
  await page.goto("/styleguide");
  if (isMobile) {
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  } else {
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 1024) {
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    }
  }
});

test("admin shell shows bottom nav on phones and sidebar on desktop", async ({ page }) => {
  await signInAsSales(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const width = page.viewportSize()?.width ?? 0;
  const nav = page.getByRole("navigation", { name: "Admin" });
  if (width >= 1024) await expect(nav.first()).toBeVisible();
  else await expect(nav.last().getByRole("link", { name: "POS" })).toBeVisible();
});
