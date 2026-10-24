import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner, signInAsSales } from "./helpers/auth";

/**
 * Seeds an event with POS-style sales straight into the ledger (the POS itself has its own
 * spec): two days of sales, a cancelled sale and a partial refund.
 */
async function seedEvent(
  name: string,
  start: string,
  end: string,
  sales: { day: string; qty: number }[],
) {
  const admin = adminClient();
  const { data: event, error } = await admin
    .from("events")
    .insert({
      name,
      type: "exhibition",
      status: "completed",
      start_date: start,
      end_date: end,
      participation_fee_fils: 100000,
      fee_payment_status: "paid",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: variant } = await admin
    .from("product_variants")
    .select("id, sku, label, price_fils, products(name, category_id, destination_id)")
    .eq("sku", "SOL-P-CAP-50")
    .single();
  const product = variant!.products as unknown as {
    name: string;
    category_id: string;
    destination_id: string;
  };
  for (const [i, s] of sales.entries()) {
    const total = variant!.price_fils * s.qty;
    const { data: order, error: e1 } = await admin
      .from("orders")
      .insert({
        channel: "pos",
        event_id: event.id,
        event_day: s.day,
        status: i === sales.length - 1 && sales.length > 2 ? "cancelled" : "completed",
        subtotal_fils: total,
        total_fils: total,
        vat_fils: Math.round((total * 500) / 10500),
        vat_rate_bp: 500,
        placed_at: `${s.day}T08:00:00Z`,
      })
      .select("id")
      .single();
    if (e1) throw e1;
    const { data: line, error: e2 } = await admin
      .from("order_lines")
      .insert({
        order_id: order.id,
        variant_id: variant!.id,
        product_name: product.name,
        variant_label: variant!.label,
        sku: variant!.sku,
        category_id: product.category_id,
        destination_id: product.destination_id,
        qty: s.qty,
        list_price_fils: variant!.price_fils,
        unit_price_fils: variant!.price_fils,
        line_total_fils: total,
      })
      .select("id")
      .single();
    if (e2) throw e2;
    await admin.from("order_line_costs").insert({ order_line_id: line.id, unit_cost_fils: 9000 });
    await admin
      .from("payments")
      .insert({ order_id: order.id, amount_fils: total, method: "cash", status: "succeeded" });
  }
  await admin
    .from("event_expenses")
    .insert({ event_id: event.id, category: "transport", amount_fils: 20000 });
  return event.id as string;
}

test.describe("event reports", () => {
  test("owner reads an event report per day, compares events and exports", async ({
    page,
  }, info) => {
    test.slow();
    const stamp = `${info.project.name}-${Date.now()}`;
    const year = 2032 + ["mobile", "tablet", "desktop"].indexOf(info.project.name);
    // Day 1: 2 units, day 2: 1 unit, plus a cancelled 5-unit sale that must not count.
    const expo = await seedEvent(`E2E Report Expo ${stamp}`, `${year}-02-10`, `${year}-02-11`, [
      { day: `${year}-02-10`, qty: 2 },
      { day: `${year}-02-11`, qty: 1 },
      { day: `${year}-02-11`, qty: 5 },
    ]);
    const popup = await seedEvent(`E2E Report Pop-up ${stamp}`, `${year}-03-01`, `${year}-03-01`, [
      { day: `${year}-03-01`, qty: 1 },
    ]);

    await signInAsOwner(page);
    await page.goto("/admin/reports");
    await page.getByRole("link", { name: new RegExp(`E2E Report Expo ${stamp}`) }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: `E2E Report Expo ${stamp}` }),
    ).toBeVisible();
    await expect(page.getByTestId("kpi-units")).toContainText("3");
    await expect(page.getByTestId("kpi-revenue")).toContainText("AED 840");
    await expect(page.getByTestId("kpi-net-profit")).toBeVisible();

    // Day 2 only.
    await page.getByRole("link", { name: /Day 2/ }).click();
    await expect(page).toHaveURL(new RegExp(`day=${year}-02-11`));
    await expect(page.getByTestId("kpi-units")).toContainText("1");
    await expect(page.getByTestId("kpi-net-profit")).toHaveCount(0);

    // Excel, PDF and CSV downloads.
    const xlsx = await page.request.get(`/admin/reports/events/${expo}/export?format=xlsx`);
    expect(xlsx.status()).toBe(200);
    expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
    const pdf = await page.request.get(`/admin/reports/events/${expo}/export?format=pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await expect(page.getByTestId("export-pdf")).toBeVisible();
    const csv = await page.request.get(`/admin/reports/events/${expo}/export?format=csv`);
    expect(await csv.text()).toContain("COGS (AED)");

    // Compare the two events.
    await page.goto(`/admin/reports/events/compare?ids=${expo},${popup}`);
    const table = page.getByTestId("compare-table");
    await expect(table).toContainText(`E2E Report Expo ${stamp}`);
    await expect(table).toContainText(`E2E Report Pop-up ${stamp}`);
    await expect(table.locator('[data-metric="units"]')).toContainText("3");
    const compareCsv = await page.request.get(
      `/admin/reports/events/compare/export?ids=${expo},${popup}&format=csv`,
    );
    expect(compareCsv.status()).toBe(200);
    const comparePdf = await page.request.get(
      `/admin/reports/events/compare/export?ids=${expo},${popup}&format=pdf`,
    );
    expect(comparePdf.headers()["content-type"]).toBe("application/pdf");
  });

  test("sales staff cannot open reports", async ({ page }) => {
    await signInAsSales(page);
    await page.goto("/admin/reports");
    await expect(page).toHaveURL(/\/admin\/forbidden/);
  });
});
