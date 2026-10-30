import { expect, test } from "@playwright/test";
import { adminClient, settle, signInAsOwner } from "./helpers/auth";
import { createTestGiveaway, refreshCatalogue, retireTestGiveaway } from "./helpers/giveaways";

/*
 * Giveaways (P2 §1): the guided order on the store (occasion → giveaway → product type → scent →
 * packaging tiles → quantity → names → bag → checkout → mock payment) and the same giveaway sold at
 * the event till. Prices are the database's: AED 25 giveaway price + AED 5 Gold box = AED 30 each.
 */

test.describe("giveaways — guided order", () => {
  test("a customer picks occasion, bottle, packaging and names, then pays for 20", async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    // Owner refresh of the cached list, the guided flow, sign-in and a full checkout.
    test.setTimeout(180_000);
    const admin = adminClient();
    const g = await createTestGiveaway(`web-${info.project.name}`);
    const staff = await browser.newPage();
    await signInAsOwner(staff);
    await refreshCatalogue(staff, g.id);
    await staff.close();

    const email = `giveaway.guided.e2e+${Date.now()}@solei.test`;
    const password = "Solei-e2e-2026";
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: "Noura", last_name: "Test" },
    });
    if (error) throw error;

    // Giveaways page: the occasion tile filters the list down to this run's giveaway.
    await page.goto("/giveaways");
    await expect(
      page.getByRole("heading", { level: 1, name: /Gifts for every guest/ }),
    ).toBeVisible();
    await page.getByTestId("occasion-tile").filter({ hasText: g.occasion.name }).click();
    await expect(page).toHaveURL(new RegExp(`occasion=${g.occasion.slug}`));
    const card = page.getByTestId("giveaway-card").filter({ hasText: g.name });
    await expect(card).toHaveCount(1);
    await card.getByRole("link", { name: g.name }).first().click();
    await expect(page).toHaveURL(new RegExp(`/giveaways/${g.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: g.name })).toBeVisible();
    // The list page stays mounted (hidden) behind it, with the same line on the card.
    await expect(page.getByText(/From 20 pieces/).locator("visible=true")).toBeVisible();
    // Choices made before the flow hydrates are lost.
    await settle(page);

    // 1 · product type → 2 · scent (real bottles of that type only).
    const flow = page.getByTestId("giveaway-flow");
    await flow.getByText(g.typeNames[0], { exact: true }).click();
    const scents = flow.getByTestId("giveaway-scent");
    await expect(scents.filter({ hasText: g.spray.name })).toHaveCount(0);
    await scents.filter({ hasText: g.perfume.name }).click();

    // Adding without the packaging explains what's missing.
    await expect(flow.getByTestId("giveaway-add")).toHaveText("Add to bag");
    await expect(flow.getByTestId("giveaway-add")).toBeEnabled();
    await flow.getByTestId("giveaway-add").click();
    await expect(flow.getByRole("alert")).toHaveText("Please choose “Packaging”.");

    // 3 · packaging as photo tiles.
    const tiles = flow.getByTestId("option-tile");
    await expect(tiles).toHaveCount(2);
    await expect(tiles.first().locator("img")).toBeAttached();
    await tiles.filter({ hasText: "Gold box" }).click();

    // 4 · quantity from the minimum; 5 · names.
    const qty = flow.getByTestId("giveaway-qty");
    await expect(qty).toHaveValue("20");
    await qty.fill("19");
    await flow.getByRole("textbox", { name: "Names on the tag" }).fill("Sara & Omar");
    await flow.getByTestId("giveaway-add").click();
    await expect(flow.getByRole("alert")).toHaveText("The minimum is 20 pieces.");
    await qty.fill("20");
    await expect(flow.getByTestId("giveaway-total")).toHaveText("Total AED 600");
    await flow.getByTestId("giveaway-add").click();

    const drawer = page.getByRole("dialog", { name: /Your Cart/ });
    await expect(drawer.getByText(/Gold box/).first()).toBeVisible();
    await expect(drawer.getByText(/Sara & Omar/).first()).toBeVisible();
    await settle(page);

    // Checkout with the mock payment page.
    await page.goto("/checkout");
    await page.getByRole("button", { name: /already have an account/i }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await page.getByLabel("Mobile").fill(`050 ${String(Date.now()).slice(-7)}`);
    await page.getByLabel("Emirate").click();
    await page.getByRole("option", { name: "Abu Dhabi" }).click();
    await page.getByLabel("Street address").fill("Hall 2, Emirates Palace");
    await page.getByLabel("Area").fill("Ras Al Akhdar");
    await page.getByLabel("City").fill("Abu Dhabi");
    await page.getByRole("checkbox", { name: /I agree to the/i }).check();
    await page.getByRole("button", { name: /continue to payment/i }).click();
    await expect(page.getByText("Test payment · no real card")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Sara & Omar/).first()).toBeVisible();

    // The order line is the real bottle, bought through the giveaway, priced by the database.
    const { data: line } = await admin
      .from("order_lines")
      .select(
        "variant_id, giveaway_product_id, qty, unit_price_fils, options, orders!inner(contact_email)",
      )
      .eq("orders.contact_email", email)
      .single();
    expect(line).toMatchObject({
      variant_id: g.perfume.variantId,
      giveaway_product_id: g.id,
      qty: 20,
      unit_price_fils: 3000,
    });
    const options = JSON.stringify(line!.options);
    expect(options).toContain("Gold box");
    expect(options).toContain("Sara & Omar");
    expect(options).toContain(g.name);

    await retireTestGiveaway(g);
  });

  test("staff sell a giveaway at the event till", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.setTimeout(90_000);
    const admin = adminClient();
    const g = await createTestGiveaway(`pos-${info.project.name}`);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    const { data: event, error } = await admin
      .from("events")
      .insert({
        name: `Giveaway till ${info.project.name} ${Date.now()}`,
        type: "popup",
        status: "confirmed",
        start_date: today,
        end_date: today,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { data: loc } = await admin
      .from("stock_locations")
      .select("id")
      .eq("event_id", event.id)
      .single();
    await admin.from("stock_movements").insert({
      variant_id: g.perfume.variantId,
      location_id: loc!.id,
      qty: 30,
      type: "receive",
      reason: "e2e",
    });

    await signInAsOwner(page);
    await refreshCatalogue(page, g.id);
    await page.goto(`/admin/pos?event=${event.id}`);
    await page.getByRole("button", { name: "Giveaway", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add a giveaway" });
    await dialog.getByRole("combobox", { name: "Giveaway" }).selectOption({ label: g.name });
    await dialog.getByText(g.perfume.name).click();
    await expect(dialog.getByText(/30 in stock/)).toBeVisible();
    await dialog.getByText("Gold box").click();
    await dialog.getByRole("textbox", { name: "Names on the tag" }).fill("Class of 2026");
    await dialog.getByRole("textbox", { name: "Pieces" }).fill("20");
    await expect(dialog.getByText("AED 30 × 20 =")).toBeVisible();
    await dialog.getByRole("button", { name: "Add to order" }).click();
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: /^Charge/ }).click();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: /SOL-\d+ · AED 600/ })).toBeVisible();

    const { data: lines } = await admin
      .from("order_lines")
      .select(
        "variant_id, giveaway_product_id, qty, unit_price_fils, options, orders!inner(event_id, channel)",
      )
      .eq("orders.event_id", event.id);
    expect(lines).toHaveLength(1);
    expect(lines![0]).toMatchObject({
      variant_id: g.perfume.variantId,
      giveaway_product_id: g.id,
      qty: 20,
      unit_price_fils: 3000,
      orders: { channel: "pos" },
    });
    expect(JSON.stringify(lines![0].options)).toContain("Class of 2026");

    await retireTestGiveaway(g);
  });
});
