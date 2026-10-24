import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, createStaffUser, signIn, signInAsOwner } from "./helpers/auth";

/** A paid website delivery order (AED 280 + 30), created straight in the database. */
async function paidDeliveryOrder() {
  const admin = adminClient();
  const { data: variant } = await admin
    .from("product_variants")
    .select("id, price_fils")
    .eq("sku", "SOL-P-CAN-50")
    .single();
  const { data, error } = await admin
    .rpc("create_web_order", {
      p: {
        client_uuid: randomUUID(),
        emirate: "abu_dhabi",
        contact: {
          name: "Courier Test",
          phone: `+97150${String(Date.now()).slice(-7)}`,
          email: `courier.e2e+${Date.now()}@solei.test`,
        },
        address: { line1: "Villa 9, Street 3", area: "Al Bateen", city: "Abu Dhabi" },
        lines: [{ variant_id: variant!.id, qty: 1, unit_price_fils: variant!.price_fils }],
        subtotal_fils: variant!.price_fils,
        discount_fils: 0,
        delivery_fee_fils: 3000,
        vat_fils: 0,
        total_fils: variant!.price_fils + 3000,
        vat_rate_bp: 0,
        prices_include_vat: true,
      },
    })
    .single();
  if (error) throw error;
  const created = data as { order_id: string };
  await admin.from("payments").insert({
    order_id: created.order_id,
    amount_fils: variant!.price_fils + 3000,
    method: "cash",
    status: "succeeded",
  });
  await admin.rpc("settle_if_paid", { p_order_id: created.order_id });
  return created.order_id;
}

test.describe("operations", () => {
  test("book the courier, follow the parcel to delivered, print the label", async ({ page }) => {
    const orderId = await paidDeliveryOrder();
    const admin = adminClient();
    await signInAsOwner(page);
    await page.goto(`/admin/orders/${orderId}`);
    await page.getByRole("button", { name: "Book courier" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Book courier" }).click();
    await expect(page.getByText(/Booked — tracking MX\d{8}/)).toBeVisible();

    const { data: order } = await admin
      .from("orders")
      .select("status, tracking_number, courier")
      .eq("id", orderId)
      .single();
    expect(order).toMatchObject({ status: "dispatched", courier: "Mock Express" });
    expect(order!.tracking_number).toMatch(/^MX\d{8}$/);

    // A day and a half later the courier reports it delivered → the order is delivered.
    await admin
      .from("fulfilments")
      .update({ created_at: new Date(Date.now() - 31 * 3_600_000).toISOString() })
      .eq("order_id", orderId);
    await page.reload();
    await page.getByRole("button", { name: "Refresh tracking" }).click();
    await expect(page.getByText("Courier says: Delivered.")).toBeVisible();
    await expect
      .poll(
        async () =>
          (await admin.from("orders").select("status").eq("id", orderId).single()).data?.status,
      )
      .toBe("delivered");

    const label = await page.request.get(`/admin/orders/${orderId}/label`);
    expect(label.status()).toBe(200);
    const html = await label.text();
    expect(html).toContain(order!.tracking_number!);
    expect(html).toContain("Villa 9, Street 3");
  });

  test("staff clock in and out; the owner sees the hours and adds a shift", async ({
    page,
    browser,
  }) => {
    const sales = await createStaffUser("sales_staff", "clock");
    await signIn(page, sales.email);
    await expect(page.getByText("Not clocked in")).toBeVisible();
    await page.getByRole("button", { name: "Clock in" }).click();
    await expect(page.getByText(/Clocked in since/)).toBeVisible();
    await page.getByRole("button", { name: "Clock out" }).click();
    await expect(page.getByText("Clocked out.")).toBeVisible();
    await page.goto("/admin/attendance");
    await expect(page.getByText("Your clock-in hours.", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shifts" })).toBeVisible();

    const owner = await browser.newPage();
    await signInAsOwner(owner);
    await owner.goto(`/admin/attendance?who=${sales.id}`);
    await expect(owner.getByText("E2E sales_staff ·").first()).toBeVisible();
    await owner.getByRole("button", { name: "Add shift" }).click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByLabel("Who").selectOption(sales.id);
    const day = new Date().toISOString().slice(0, 10);
    await dialog.getByLabel("Clock in").fill(`${day}T06:00`);
    await dialog.getByLabel("Clock out").fill(`${day}T08:30`);
    await dialog.getByLabel("Note").fill("Paper timesheet");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(owner.getByText("Shift saved.")).toBeVisible();
    await expect(owner.getByText("2 h 30 min").first()).toBeVisible();
    const { data } = await adminClient()
      .from("staff_attendance")
      .select("note")
      .eq("user_id", sales.id);
    expect(data!.map((r) => r.note)).toContain("Paper timesheet");
    await owner.close();
  });
});
