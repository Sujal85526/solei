import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { addToBag, createTestProduct } from "./helpers/catalog";
import { withLock } from "./helpers/lock";

test.describe("points & tiers", () => {
  test.describe.configure({ mode: "serial" });

  // The programme ships switched off; leave it that way for everything else.
  test.afterAll(async () => {
    await withLock("points", async () => {
      await adminClient().from("rewards_settings").update({ points_enabled: false }).eq("id", 1);
    });
  });

  test("owner switches points on; a customer spends points at checkout and earns on what they paid", async ({
    page,
    browser,
  }) => {
    // Owner sign-in, a full checkout and the account page: more than the default 30 s.
    test.setTimeout(300_000);
    const admin = adminClient();

    // The points switch is shop-wide: one test at a time across projects.
    await withLock("points", async () => {
      // Owner turns the programme on.
      const staff = await browser.newPage();
      await signInAsOwner(staff);
      await staff.goto("/admin/loyalty/points");
      await staff.getByLabel(/Points & tiers are on/).check();
      await staff.getByRole("button", { name: "Save", exact: true }).click();
      await expect(staff.getByText("Points settings saved.")).toBeVisible();
      const { data: s } = await admin.from("rewards_settings").select("points_enabled").single();
      expect(s!.points_enabled).toBe(true);

      // A customer with 500 points (account + customer record with the same email).
      const email = `points.e2e+${Date.now()}@solei.test`;
      const password = "Solei-e2e-2026";
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: "Maha", last_name: "Test" },
      });
      if (error) throw error;
      const { data: customer } = await admin
        .from("customers")
        .insert({ name: "Maha Test", email })
        .select("id")
        .single();
      await admin
        .from("points_ledger")
        .insert({ customer_id: customer!.id, entry: "adjust", points: 500, note: "e2e" });

      // Checkout: a AED 280 perfume + AED 30 delivery, 500 points = AED 25 off.
      const perfume = await createTestProduct("points");
      await page.goto(`/products/${perfume.slug}`);
      await addToBag(page);
      await page.goto("/checkout");
      await page.getByRole("button", { name: /already have an account/i }).click();
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
      // A fresh number each run: orders match customers by phone first.
      await page.getByLabel("Mobile").fill(`050 ${String(Date.now()).slice(-7)}`);
      await page.getByLabel("Emirate").click();
      await page.getByRole("option", { name: "Abu Dhabi" }).click();
      await page.getByLabel("Street address").fill("Villa 5, Street 7");
      await page.getByLabel("Area").fill("Al Raha");
      await page.getByLabel("City").fill("Abu Dhabi");
      const fold = page.getByText("Show order summary");
      if (await fold.isVisible()) await fold.click();
      await page
        .getByLabel(/Use 500 points/)
        .locator("visible=true")
        .check();
      await expect(page.getByText("AED 285").locator("visible=true").first()).toBeVisible();
      await page.getByRole("checkbox", { name: /I agree to the/i }).check();
      await page.getByRole("button", { name: /continue to payment/i }).click();
      await page.getByRole("button", { name: "Pay with test card" }).click();
      await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
        timeout: 20_000,
      });

      // 500 spent, 285 earned on the AED 285 paid by card (Explorer ×1).
      await expect
        .poll(async () => (await admin.rpc("points_balance", { p_customer: customer!.id })).data)
        .toBe(285);

      // Account → Rewards.
      await page.goto("/account");
      await expect(page.getByText("Rewards")).toBeVisible();
      await expect(page.getByText("Worth AED 14.25 off your next order.")).toBeVisible();

      // Back off through the admin (so the cached programme settings refresh too).
      await staff.reload();
      await staff.getByLabel(/Points & tiers are on/).uncheck();
      await staff.getByRole("button", { name: "Save", exact: true }).click();
      await expect(staff.getByText("Off — customers see nothing")).toBeVisible();
      await staff.close();
    });
  });
});
