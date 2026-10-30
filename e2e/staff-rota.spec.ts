import { expect, test } from "@playwright/test";
import { adminClient, createStaffUser, settle, signIn, signInAsOwner } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";
import { seedPaidOrder } from "./helpers/reports";

/** Asia/Dubai business day, `offset` days from today. */
function dubaiDay(offset = 0) {
  return new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Dubai",
  });
}

/** The Monday of the week holding `day`. */
function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

test.describe("staff rota & staff report", () => {
  test("owner plans a shift, the staff member sees it, and their sales show in Reports → Staff", async ({
    page,
    browser,
  }, info) => {
    test.slow();
    const stamp = `${info.project.name} ${Date.now()}`;
    const name = `E2E Rota ${stamp}`;
    const member = await createStaffUser("sales_staff", `rota-${info.project.name}`);
    const { error } = await adminClient()
      .from("staff_profiles")
      .update({ full_name: name })
      .eq("user_id", member.id);
    if (error) throw error;

    // A sale they made today (2 × AED 280).
    const today = dubaiDay();
    const perfume = await createTestProduct(`rota-${info.project.name}`);
    await seedPaidOrder(perfume, { day: today, qty: 2, staffId: member.id });

    // ─── Owner plans a shift next week ───────────────────────────────────────────────────
    const shiftDay = dubaiDay(7);
    const week = mondayOf(shiftDay);
    const note = `Booth lead ${stamp}`;
    await signInAsOwner(page);
    await page.goto("/admin/attendance");
    await page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Rota" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Rota" })).toBeVisible();
    await page.goto(`/admin/attendance/rota?week=${week}`);
    await page.getByRole("button", { name: "Plan shift" }).click();
    const dialog = page.getByRole("dialog", { name: "Plan a shift" });
    await dialog.getByRole("combobox", { name: /^Who/ }).selectOption({ label: name });
    await dialog.locator("#rotaDay").fill(shiftDay);
    await dialog.locator("#rotaStart").fill("10:00");
    await dialog.locator("#rotaEnd").fill("14:00");
    await dialog.getByRole("textbox", { name: /^Note/ }).fill(note);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Shift saved.")).toBeVisible();
    const shift = page.getByRole("listitem").filter({ hasText: note }).last();
    await expect(shift).toContainText(name);
    await expect(shift).toContainText("10:00–14:00");

    // ─── The staff member sees their own shift ───────────────────────────────────────────
    const theirs = await browser.newContext();
    const staffPage = await theirs.newPage();
    await signIn(staffPage, member.email);
    await expect(staffPage.getByRole("heading", { level: 1, name: /^Hello/ })).toBeVisible({
      timeout: 30_000,
    });
    await settle(staffPage);
    await staffPage.goto(`/admin/attendance/rota?week=${week}`);
    await expect(staffPage.getByText("Your planned shifts.", { exact: false })).toBeVisible();
    await expect(staffPage.getByText(note)).toBeVisible();
    await expect(staffPage.getByText("10:00–14:00")).toBeVisible();
    await expect(staffPage.getByRole("button", { name: "Plan shift" })).toHaveCount(0);
    await theirs.close();

    // ─── Reports → Staff: today's sales per person, and the Excel ────────────────────────
    await page.goto("/admin/reports");
    await page
      .getByRole("navigation", { name: "Section" })
      .getByRole("link", { name: "Staff" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Staff report" })).toBeVisible();
    await settle(page);
    const period = page.getByRole("form", { name: "Period" });
    await period.getByLabel("From").fill(today);
    await period.getByLabel("To").fill(today);
    await period.getByRole("button", { name: "Show" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${today}&to=${today}`));
    const person = page.getByRole("list", { name: "Staff" }).getByRole("listitem").filter({
      hasText: name,
    });
    await expect(person).toContainText("AED 560");
    await expect(person).toContainText("1 · 2");

    const xlsx = await page.request.get(`/admin/reports/staff/export?from=${today}&to=${today}`);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  });
});
