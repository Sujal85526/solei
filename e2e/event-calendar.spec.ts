import { expect, test, type Page } from "@playwright/test";
import { adminClient, createStaffUser, signInAsOwner, signInAsSales } from "./helpers/auth";

// 1×1 PNG (receipt photo)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Far-future dates per project so runs don't crowd each other's calendars. */
function datesFor(project: string) {
  const month = { mobile: "03", tablet: "04", desktop: "05" }[project] ?? "06";
  return { start: `2030-${month}-10`, end: `2030-${month}-12`, overlapStart: `2030-${month}-12` };
}

/** A hidden test product with 50 units in main stock, so stock maths is exact. */
async function createStockedVariant(stamp: string) {
  const admin = adminClient();
  const { data: category } = await admin.from("categories").select("id").limit(1).single();
  const { data: product, error } = await admin
    .from("products")
    .insert({
      category_id: category!.id,
      name: `E2E Event Scent ${stamp}`,
      slug: `e2e-event-scent-${stamp}`.toLowerCase(),
      active: false,
    })
    .select("id, name")
    .single();
  if (error) throw error;
  const sku = `E2E-EV-${stamp}`.toUpperCase().slice(0, 40);
  const { data: variant, error: e2 } = await admin
    .from("product_variants")
    .insert({ product_id: product.id, label: "50 ml", size_ml: 50, sku, price_fils: 29500 })
    .select("id")
    .single();
  if (e2) throw e2;
  const { data: main } = await admin
    .from("stock_locations")
    .select("id")
    .eq("is_default", true)
    .single();
  const { error: e3 } = await admin.from("stock_movements").insert({
    variant_id: variant.id,
    location_id: main!.id,
    qty: 50,
    type: "receive",
    reason: "E2E",
  });
  if (e3) throw e3;
  return { variantId: variant.id, mainId: main!.id, productName: product.name };
}

async function onHand(variantId: string, locationId: string) {
  const { data } = await adminClient()
    .from("stock_levels")
    .select("on_hand")
    .eq("variant_id", variantId)
    .eq("location_id", locationId)
    .maybeSingle();
  return data?.on_hand ?? 0;
}

async function fillEvent(
  page: Page,
  v: { name: string; start: string; end: string; location: string; status?: string },
) {
  await page.getByLabel("Event name").fill(v.name);
  await page.getByLabel("Type").selectOption("exhibition");
  await page.getByLabel("Status").selectOption(v.status ?? "confirmed");
  await page.getByLabel("First day").fill(v.start);
  await page.getByLabel("Last day").fill(v.end);
  await page.getByLabel("Venue / location").fill(v.location);
  await page.getByLabel("Emirate").selectOption("abu_dhabi");
}

test.describe("event calendar", () => {
  test("owner runs an exhibition from booking to close-out", async ({ page }, info) => {
    test.slow();
    const stamp = `${info.project.name}-${Date.now()}`;
    const dates = datesFor(info.project.name);
    const name = `E2E Expo ${stamp}`;
    const venue = `E2E Hall ${stamp}`;
    const stock = await createStockedVariant(stamp);
    const helper = await createStaffUser("sales_staff", `ev-${info.project.name}`);
    const helperName = `E2E Booth ${stamp}`;
    await adminClient()
      .from("staff_profiles")
      .update({ full_name: helperName })
      .eq("user_id", helper.id);

    await signInAsOwner(page);

    // Create a 3-day exhibition with hours.
    await page.goto(`/admin/calendar/new?date=${dates.start}`);
    await fillEvent(page, { name, start: dates.start, end: dates.end, location: venue });
    await page.getByLabel("Opens").fill("10:00");
    await page.getByLabel("Closes").fill("22:00");
    await page.getByLabel("Participation fee (AED)").fill("1500");
    await page.getByLabel("Fee payment").selectOption("unpaid");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("10:00–22:00 daily")).toBeVisible();
    const eventId = page.url().split("/events/")[1].split(/[?#]/)[0];

    // A second, overlapping event shows the clash before saving — but can still be saved.
    await page.goto(`/admin/calendar/new`);
    await fillEvent(page, {
      name: `E2E Pop-up ${stamp}`,
      start: dates.overlapStart,
      end: dates.overlapStart,
      location: venue,
      status: "potential",
    });
    const warning = page.getByTestId("overlap-warning");
    await expect(warning).toBeVisible();
    await expect(warning.getByRole("link", { name })).toBeVisible();
    await expect(warning.getByText("Same venue").first()).toBeVisible();
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: `E2E Pop-up ${stamp}` }),
    ).toBeVisible();

    // Both appear on the calendar.
    await page.goto(`/admin/calendar?view=list&date=${dates.start}`);
    await expect(page.getByTestId("event-card").filter({ hasText: name })).toBeVisible();

    // Staff
    await page.goto(`/admin/calendar/events/${eventId}?tab=staff`);
    await page.getByLabel("Team member").selectOption({ label: helperName });
    await page.getByLabel("Role at the event").fill("Booth lead");
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByTestId("event-staff").getByText(helperName)).toBeVisible();

    // Expense with a receipt
    await page.goto(`/admin/calendar/events/${eventId}?tab=expenses`);
    await page.getByLabel("Category").selectOption("transport");
    await page.getByLabel("Amount (AED)").fill("450");
    await page.getByLabel("Note").fill("Van hire");
    await page
      .getByTestId("receipt-upload")
      .setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("receipt.png")).toBeVisible();
    await page.getByRole("button", { name: "Add expense" }).click();
    await expect(page.getByTestId("expense-list").getByText("Van hire")).toBeVisible();
    await expect(page.getByTestId("expenses-total")).toHaveText("AED 450");
    await expect(
      page.getByTestId("expense-list").getByRole("link", { name: "Receipt" }),
    ).toBeVisible();

    // Allocate 20
    await page.goto(`/admin/calendar/events/${eventId}?tab=stock`);
    await page.getByRole("button", { name: "Allocate stock" }).click();
    const allocate = page.getByRole("dialog");
    await allocate.locator(`[id="qty-${stock.variantId}"]`).fill("20");
    await allocate.getByRole("button", { name: "Allocate 20 units" }).click();
    await expect(page.getByText("20 units allocated to the event.")).toBeVisible();
    expect(await onHand(stock.variantId, stock.mainId)).toBe(30);

    // Simulate 5 POS sales at the event location.
    const admin = adminClient();
    const { data: loc } = await admin
      .from("stock_locations")
      .select("id")
      .eq("event_id", eventId)
      .single();
    await admin.from("stock_movements").insert({
      variant_id: stock.variantId,
      location_id: loc!.id,
      qty: -5,
      type: "sale",
      event_id: eventId,
    });
    await page.reload();
    const row = page.locator(`tr[data-variant="${stock.variantId}"]`);
    await expect(row.locator('[data-col="allocated"]')).toHaveText("20");
    await expect(row.locator('[data-col="sold"]')).toHaveText("5");
    await expect(row.locator('[data-col="remaining"]')).toHaveText("15");

    // Close: 14 come back, 1 broke.
    await page.getByRole("button", { name: "Close event" }).click();
    const closeDialog = page.getByRole("dialog");
    await closeDialog.locator(`[id="ret-${stock.variantId}"]`).fill("14");
    await expect(closeDialog.getByText("1 broken", { exact: true })).toBeVisible();
    await closeDialog.getByLabel(/Breakage reason/).fill("Dropped tester");
    await closeDialog.getByRole("button", { name: "Close event & return stock" }).click();
    await expect(page.getByText(/Event closed — \d+ returned to stock/)).toBeVisible();

    await page.reload();
    await expect(row.locator('[data-col="returned"]')).toHaveText("14");
    await expect(row.locator('[data-col="damaged"]')).toHaveText("1");
    await expect(row.locator('[data-col="remaining"]')).toHaveText("0");
    await expect(page.getByText(/Closed .* remaining stock was returned/)).toBeVisible();
    expect(await onHand(stock.variantId, stock.mainId)).toBe(44);
    expect(await onHand(stock.variantId, loc!.id)).toBe(0);
    const { data: ev } = await admin
      .from("events")
      .select("status, closed_at")
      .eq("id", eventId)
      .single();
    expect(ev?.status).toBe("completed");
    expect(ev?.closed_at).not.toBeNull();
    const { data: dmg } = await admin
      .from("stock_movements")
      .select("qty, reason")
      .eq("location_id", loc!.id)
      .eq("type", "damage");
    expect(dmg).toEqual([{ qty: -1, reason: "Dropped tester" }]);
  });

  test("sales staff see the calendar but not expenses", async ({ page }, info) => {
    const stamp = `${info.project.name}-${Date.now()}`;
    const dates = datesFor(info.project.name);
    const name = `E2E Private ${stamp}`;
    const admin = adminClient();
    const { data: ev, error } = await admin
      .from("events")
      .insert({
        name,
        type: "private_booking",
        status: "confirmed",
        start_date: dates.start,
        end_date: dates.start,
        location: "Saadiyat villa",
      })
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("event_expenses").insert({
      event_id: ev.id,
      category: "setup",
      amount_fils: 99_900,
      note: `Secret florist ${stamp}`,
    });

    await signInAsSales(page);
    await page.goto(`/admin/calendar?view=list&date=${dates.start}`);
    const card = page.getByTestId("event-card").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card.getByText("Private booking")).toBeVisible();
    await card.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Event sections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Expenses" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

    await page.goto(`/admin/calendar/events/${ev.id}?tab=expenses`);
    await expect(page.getByText(`Secret florist ${stamp}`)).toHaveCount(0);
    await expect(page.getByText("AED 999")).toHaveCount(0);

    // Sales staff can't create events either.
    await page.goto("/admin/calendar/new");
    await expect(page).toHaveURL(/\/admin\/forbidden/);
  });
});
