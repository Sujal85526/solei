import { expect, test, type Page } from "@playwright/test";
import { adminClient, createOwnerWithTotp, signInAsOwner } from "./helpers/auth";

/** A unique UAE mobile per call: +9715XXXXXXXX. */
function uniquePhone() {
  const n = String((Date.now() + Math.floor(Math.random() * 1e6)) % 10_000_000).padStart(7, "0");
  return `+9715${["0", "2", "4", "5", "6", "8"][Math.floor(Math.random() * 6)]}${n}`;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/**
 * A customer with paid orders (service role). Each order is `[fils, days ago]`; the payment covers
 * it in full, so it counts towards the label's spend.
 */
async function seedBuyer(name: string, orders: [number, number][]) {
  const admin = adminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const phone = uniquePhone();
    const { data: customer, error } = await admin
      .from("customers")
      .insert({
        name,
        phone,
        email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`,
        source: "whatsapp",
      })
      .select("id")
      .single();
    if (error?.code === "23505") continue;
    if (error) throw error;
    for (const [fils, ago] of orders) {
      const { data: order, error: e2 } = await admin
        .from("orders")
        .insert({
          customer_id: customer.id,
          channel: "whatsapp",
          status: "new",
          subtotal_fils: fils,
          total_fils: fils,
          contact_name: name,
          contact_phone: phone,
          placed_at: daysAgo(ago),
        })
        .select("id, number")
        .single();
      if (e2) throw e2;
      const { error: e3 } = await admin
        .from("payments")
        .insert({ order_id: order.id, amount_fils: fils, method: "cash", status: "succeeded" });
      if (e3) throw e3;
    }
    return customer.id as string;
  }
  throw new Error("could not find a free phone number");
}

/** Search the customer list by name with a label filter. */
async function searchWithLabel(page: Page, name: string, label: string) {
  await page.goto("/admin/customers");
  await page.getByLabel("Search customers").fill(name);
  await page.getByLabel("Label", { exact: true }).selectOption({ label });
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/label=/);
}

test.describe("customer labels & complaints log", () => {
  test("labels are worked out from purchases and filter the customer list", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.slow();
    const { data: rules } = await adminClient()
      .from("settings")
      .select(
        "label_vip_spend_fils, label_vip_months, label_inactive_days, label_new_days, label_returning_orders",
      )
      .single();
    const r = rules!;
    const stamp = `${info.project.name} ${Date.now()}`;
    // Small orders stay under the VIP spend (unless VIP is switched off with a 0 threshold).
    const small = 1_000;
    const vipOn = r.label_vip_spend_fils > small * r.label_returning_orders;
    const customers = {
      ...(vipOn ? { VIP: await seedBuyer(`E2E VIP ${stamp}`, [[r.label_vip_spend_fils, 1]]) } : {}),
      New: await seedBuyer(`E2E New ${stamp}`, [[small, 1]]),
      Inactive: await seedBuyer(`E2E Inactive ${stamp}`, [[small, r.label_inactive_days + 5]]),
      // First purchase before the "new" window, latest one recent.
      Returning: await seedBuyer(`E2E Returning ${stamp}`, [
        [small, r.label_new_days + 5],
        ...Array.from({ length: r.label_returning_orders - 1 }, (): [number, number] => [small, 1]),
      ]),
    };

    await signInAsOwner(page);

    // The rules are shown on Labels & emails.
    await page.goto("/admin/customers/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Labels & emails" })).toBeVisible();
    await expect(
      page.getByText(`No purchase in the last ${r.label_inactive_days} days`),
    ).toBeVisible();
    await expect(
      page.getByText(`First purchase in the last ${r.label_new_days} days`),
    ).toBeVisible();

    for (const [label, id] of Object.entries(customers)) {
      const name = `E2E ${label} ${stamp}`;
      // List: the label filter finds them, with the badge on the row.
      await searchWithLabel(page, name, label);
      await expect(page.getByText("1 customer match")).toBeVisible();
      const row = page
        .getByRole("list", { name: "Customers" })
        .locator("visible=true")
        .getByRole("link", { name: new RegExp(name) });
      await expect(row.getByText(label, { exact: true })).toBeVisible();

      // Profile: the badge in the header.
      await page.goto(`/admin/customers/${id}`);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await expect(
        page.locator("main").getByText(label, { exact: true }).locator("visible=true").first(),
      ).toBeVisible();
    }

    // Another label filters them out.
    await searchWithLabel(page, `E2E New ${stamp}`, "Inactive");
    await expect(page.getByText("No customers match these filters.")).toBeVisible();
  });

  test("staff log a complaint, resolve it and find it in the log", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.slow();
    const stamp = `${info.project.name} ${Date.now()}`;
    const name = `E2E Complaint ${stamp}`;
    const id = await seedBuyer(name, [[28_000, 2]]);
    const owner = await createOwnerWithTotp(`fb${info.project.name.slice(0, 1)}`);
    const message = `Cap was loose on arrival (${stamp})`;
    const resolution = `Sent a new bottle (${stamp})`;

    await signInAsOwner(page, owner);
    await page.goto(`/admin/customers/${id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    // Log it from the customer's page: complaint, about their order, handled by me.
    await page.getByRole("button", { name: "Log feedback" }).click();
    const dialog = page.getByRole("dialog", { name: "Log feedback" });
    await dialog.getByLabel("About an order").selectOption({ index: 1 });
    await dialog.getByLabel("Kind").selectOption("complaint");
    await dialog.getByLabel("What they said").fill(message);
    await dialog.getByLabel("Handled by").selectOption(owner.id);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Added to the log.")).toBeVisible();

    const log = page.getByRole("list", { name: "Feedback" }).locator("visible=true");
    const entry = log.getByRole("listitem").filter({ hasText: message });
    await expect(entry.getByText("Complaint", { exact: true })).toBeVisible();
    await expect(entry.getByText("Handled by E2E owner")).toBeVisible();

    // Resolve it with what was done.
    await entry.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Feedback", exact: true });
    await edit.getByLabel("Status").selectOption("resolved");
    await edit.getByLabel("What we did").fill(resolution);
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await expect(entry.getByText(`What we did: ${resolution}`)).toBeVisible();
    await expect(entry.getByText(/\(resolved /)).toBeVisible();

    const { data: row } = await adminClient()
      .from("customer_feedback")
      .select("kind, status, source, assigned_to, resolution, resolved_at, order_id")
      .eq("customer_id", id)
      .single();
    expect(row).toMatchObject({
      kind: "complaint",
      status: "resolved",
      source: "staff",
      assigned_to: owner.id,
      resolution,
    });
    expect(row!.resolved_at).not.toBeNull();
    expect(row!.order_id).not.toBeNull();

    // The log page: resolved complaints handled by me include it; open ones don't.
    await page.goto("/admin/customers/feedback");
    await expect(
      page.getByRole("heading", { level: 1, name: "Complaints & suggestions" }),
    ).toBeVisible();
    const filters = page.getByRole("form", { name: "Filter feedback" });
    await filters.getByLabel("Status").selectOption("resolved");
    await filters.getByLabel("Kind").selectOption("complaint");
    await filters.getByLabel("Handled by").selectOption("me");
    await filters.getByRole("button", { name: "Show" }).click();
    await expect(page).toHaveURL(/status=resolved/);
    const found = page
      .getByRole("list", { name: "Feedback" })
      .locator("visible=true")
      .getByRole("listitem")
      .filter({ hasText: message });
    await expect(found).toBeVisible();
    await expect(found.getByRole("link", { name })).toBeVisible();

    await page.goto("/admin/customers/feedback?status=open&assigned=me");
    await expect(page.getByText(message)).toHaveCount(0);
  });
});
