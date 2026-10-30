import { expect, test, type Page } from "@playwright/test";
import { signInAsOwner } from "./helpers/auth";
import { createTestProduct } from "./helpers/catalog";
import { quietDay, seedPaidOrder } from "./helpers/reports";

/** The amount on one line of the profit & loss list. */
const pnlLine = (page: Page, label: string) =>
  page
    .getByTestId("pnl")
    .locator("div")
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator("dd");

test.describe("business report & expenses", () => {
  test("owner reads the business report for a period, downloads it, and an expense lands in the P&L", async ({
    page,
  }, info) => {
    test.slow();
    // One quiet day long ago: the only sale and expense in it are this test's own.
    const day = quietDay(info.project.name);
    const perfume = await createTestProduct(`biz-${info.project.name}`);
    await seedPaidOrder(perfume, { day, qty: 2, unitCostFils: 9_000 }); // AED 560, COGS AED 180

    await signInAsOwner(page);
    await page.goto("/admin/reports");
    const tabs = page.getByRole("navigation", { name: "Section" });
    await expect(tabs.getByRole("link", { name: "Expenses" })).toBeVisible();
    await tabs.getByRole("link", { name: "Business" }).click();
    await expect(page).toHaveURL(/\/admin\/reports\/business/);
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();

    // Presets are links; "This year" then a custom one-day range.
    await page.getByTestId("range-year").click();
    await expect(page).toHaveURL(/range=year/);
    await expect(page.getByTestId("range-year")).toHaveAttribute("aria-current", "page");
    const custom = page.getByRole("form", { name: "Custom dates" });
    await custom.getByLabel("From").fill(day);
    await custom.getByLabel("To").fill(day);
    await custom.getByRole("button", { name: "Custom dates" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${day}&to=${day}`));
    await expect(page.getByTestId("report-range")).toContainText("1 day");

    await expect(page.getByTestId("kpi-revenue")).toContainText("AED 560");
    await expect(page.getByTestId("kpi-net-profit")).toContainText("AED 380");
    for (const title of [
      "Sales over time",
      "Revenue by channel",
      "Payment methods",
      "Orders",
      "Products & categories",
      "Profit & loss",
      "Customers",
      "Stock: fast and slow movers",
    ])
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("table", { name: "Revenue by channel" })).toContainText("Direct");
    await expect(page.getByRole("table", { name: "Payment methods" })).toContainText("Cash");
    await expect(page.getByTestId("best-sellers")).toContainText(perfume.name);
    await expect(pnlLine(page, "Product cost (COGS)")).toHaveText("-AED 180");
    await expect(pnlLine(page, "Business expenses")).toHaveText("AED 0");

    // Excel and PDF of the range on screen.
    const exportHref = await page
      .locator('[data-testid="export-xlsx"][href^="/admin/reports/business/export"]')
      .getAttribute("href");
    const xlsx = await page.request.get(exportHref!);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    const pdf = await page.request.get(exportHref!.replace("format=xlsx", "format=pdf"));
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Expenses: rent paid that day.
    const note = `E2E rent ${info.project.name} ${Date.now()}`;
    await page.goto(`/admin/reports/expenses?month=${day.slice(0, 7)}`);
    await expect(
      page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Expenses" }),
    ).toHaveAttribute("aria-current", "page");
    await page.getByRole("combobox", { name: /^Category/ }).selectOption({ label: "Rent" });
    await page.getByRole("textbox", { name: /^Amount/ }).fill("1234");
    await page.getByLabel(/^Date/).fill(day);
    await page.getByRole("textbox", { name: /^Note/ }).fill(note);
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.getByText("Expense added.")).toBeVisible();
    const row = page.getByTestId("business-expense-list").getByRole("listitem").filter({
      hasText: note,
    });
    await expect(row).toContainText("Rent");
    await expect(row).toContainText("AED 1,234");

    // Back on the business report the expense comes off the profit: 560 − 180 − 1,234.
    await page.goto(`/admin/reports/business?range=custom&from=${day}&to=${day}`);
    await expect(pnlLine(page, "Business expenses")).toHaveText("-AED 1,234");
    await expect(pnlLine(page, "Estimated net profit")).toContainText("-AED 854");
    await expect(page.getByRole("table", { name: "Business expenses by category" })).toContainText(
      "Rent",
    );
  });
});
