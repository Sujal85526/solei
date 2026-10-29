import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";

/** A unique UAE mobile per test run: 05X XXX XXXX → +9715XXXXXXXX. */
function uniqueMobile() {
  const n = String(Date.now() % 10_000_000).padStart(7, "0");
  const prefix = ["0", "2", "4", "5", "6", "8"][Math.floor(Math.random() * 6)];
  return {
    local: `05${prefix} ${n.slice(0, 3)} ${n.slice(3)}`,
    e164: `+9715${prefix}${n}`,
  };
}

/** Seed a customer with one partly paid WhatsApp order (service role, bypasses RLS). */
async function seedCustomer(name: string) {
  const admin = adminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const phone = uniqueMobile();
    const { data: customer, error } = await admin
      .from("customers")
      .insert({
        name,
        phone: phone.e164,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
        emirate: "abu_dhabi",
        source: "whatsapp",
        marketing_consent: true,
        marketing_consent_at: new Date().toISOString(),
        marketing_channels: ["email", "whatsapp"],
      })
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    if (error) throw error;
    const { data: order, error: e2 } = await admin
      .from("orders")
      .insert({
        customer_id: customer.id,
        channel: "whatsapp",
        status: "new",
        total_fils: 56000,
        subtotal_fils: 56000,
        contact_name: name,
        contact_phone: phone.e164,
      })
      .select("id, number")
      .single();
    if (e2) throw e2;
    const { error: e3 } = await admin
      .from("payments")
      .insert({ order_id: order.id, amount_fils: 20000, method: "cash", status: "succeeded" });
    if (e3) throw e3;
    return { id: customer.id, phone, orderNumber: order.number };
  }
  throw new Error("could not find a free phone number");
}

test.describe("customers CRM", () => {
  test("search by local phone format, open the profile, edit notes and record an opt-out", async ({
    page,
  }, info) => {
    test.slow();
    const name = `E2E Customer ${info.project.name} ${Date.now()}`;
    const seeded = await seedCustomer(name);

    await signInAsOwner(page);
    await page.goto("/admin/customers");
    await page.getByLabel("Search customers").fill(seeded.phone.local);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("1 customer match")).toBeVisible();
    await page.getByRole("link", { name: new RegExp(name) }).click();

    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    // Stats: one order, AED 200 received of 560.
    await expect(page.getByText("AED 200", { exact: true }).first()).toBeVisible();
    const orders = page.getByRole("list", { name: "Orders" });
    await expect(orders.getByText(seeded.orderNumber)).toBeVisible();
    await expect(orders.getByText("WhatsApp")).toBeVisible();
    await expect(orders.getByText("Part paid")).toBeVisible();
    await expect(page.getByText("Passport launches soon")).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      `https://wa.me/${seeded.phone.e164.slice(1)}`,
    );

    // Notes
    await page.getByLabel("Notes").fill("Prefers Capri; gift wrap for birthdays.");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect(page.getByText("Notes saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Notes")).toHaveValue("Prefers Capri; gift wrap for birthdays.");

    // Opt-out
    await expect(page.getByText("Opted in")).toBeVisible();
    await page.getByRole("button", { name: "Record opt-out" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Record opt-out" }).click();
    await expect(page.getByText("Opt-out recorded — no more marketing.")).toBeVisible();
    await expect(page.getByText("Unsubscribed")).toBeVisible();
    await expect(page.getByText(/Opted out on/)).toBeVisible();

    const { data } = await adminClient()
      .from("customers")
      .select("marketing_consent, unsubscribed_at, notes")
      .eq("id", seeded.id)
      .single();
    expect(data?.marketing_consent).toBe(false);
    expect(data?.unsubscribed_at).not.toBeNull();
  });

  test("quick-create a customer through the picker on the list page", async ({ page }, info) => {
    test.slow();
    const name = `E2E Picker ${info.project.name} ${Date.now()}`;
    let phone = uniqueMobile();
    // Make sure the number is free.
    for (let i = 0; i < 5; i++) {
      const { count } = await adminClient()
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone.e164);
      if (!count) break;
      phone = uniqueMobile();
    }

    await signInAsOwner(page);
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "New customer" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "Customer" }).fill(phone.local);
    const create = dialog.getByRole("option", { name: "Create new customer" });
    await expect(create).toBeVisible();
    await create.click();

    // Phone is prefilled from the search; add a name and save.
    await expect(dialog.getByLabel("Phone")).toHaveValue(phone.local);
    await dialog.getByLabel("Name").fill(name);
    // Email is required for staff-added customers (it's how they later claim their passport).
    await dialog.getByLabel("Email").fill(`e2e-${Date.now()}@example.com`);
    await dialog.getByLabel("Emirate").selectOption({ label: "Dubai" });
    await dialog.getByLabel("Agrees to marketing messages").check();
    await dialog.getByRole("button", { name: "Save customer" }).click();

    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Opted in")).toBeVisible();

    // Searching the same number again finds the record instead of offering a duplicate.
    await page.goto("/admin/customers");
    await page.getByRole("button", { name: "New customer" }).click();
    await page.getByRole("dialog").getByRole("combobox").fill(phone.e164);
    await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    const { data } = await adminClient()
      .from("customers")
      .select("phone, emirate, source, marketing_channels")
      .eq("phone", phone.e164)
      .single();
    expect(data).toMatchObject({
      phone: phone.e164,
      emirate: "dubai",
      source: "manual",
      marketing_channels: ["whatsapp"],
    });
  });

  test("exports the filtered list as CSV", async ({ page }, info) => {
    test.slow();
    const name = `E2E Export ${info.project.name} ${Date.now()}`;
    const seeded = await seedCustomer(name);

    await signInAsOwner(page);
    await page.goto(`/admin/customers?q=${encodeURIComponent(name)}`);
    await expect(page.getByText("1 customer match")).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^solei-customers-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = await readFile((await download.path())!, "utf8");
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toContain("Marketing consent");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(name);
    expect(lines[1]).toContain(seeded.phone.e164);
    expect(lines[1]).toContain(",200.00,");
  });
});
