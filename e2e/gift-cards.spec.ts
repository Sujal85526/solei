import { expect, test, type Page } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { addToBag, createTestProduct } from "./helpers/catalog";

/** A verified storefront account, created directly for the test. */
async function customerAccount(tag: string) {
  const email = `gift.${tag}.e2e+${Date.now()}@solei.test`;
  const password = "Solei-e2e-2026";
  const { error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Sara", last_name: "Test" },
  });
  if (error) throw error;
  return { email, password };
}

async function signInFromDrawer(page: Page, account: { email: string; password: string }) {
  // Checkout opens on "create account"; the sign-in drawer opens on "sign in".
  const toSignIn = page.getByRole("button", { name: /already have an account/i });
  await expect(page.getByLabel("Email address")).toBeVisible();
  if (await toSignIn.isVisible()) await toSignIn.click();
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe("gift cards", () => {
  test("buy a card for someone, then spend it all at checkout", async ({ page }) => {
    const buyer = await customerAccount("buyer");
    const recipientEmail = `mira.e2e+${Date.now()}@solei.test`;

    // Buy: AED 500 for Mira.
    await page.goto("/gift-cards");
    await page.getByRole("button", { name: "Sign in to buy" }).click();
    await signInFromDrawer(page, buyer);
    await page.getByText("AED 500", { exact: true }).click();
    await page.getByLabel("Their name").fill("Mira");
    await page.getByLabel("Their email").fill(recipientEmail);
    await page.getByLabel("Message (optional)").fill("Happy birthday");
    await page.getByRole("button", { name: /buy gift card · AED 500/i }).click();
    await expect(page.getByText("Test payment · no real card")).toBeVisible();
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByText(`we've emailed it to ${recipientEmail}`)).toBeVisible({
      timeout: 20_000,
    });

    const admin = adminClient();
    const { data: card } = await admin
      .from("gift_cards")
      .select("id, code, status, sent_at")
      .eq("recipient_email", recipientEmail)
      .single();
    expect(card!.status).toBe("active");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("notification_log")
          .select("template_key")
          .eq("recipient", recipientEmail);
        return data?.map((r) => r.template_key) ?? [];
      })
      .toContain("gift_card_delivered");

    // Spend: Mira (another account) uses the code on a AED 280 perfume + AED 30 delivery —
    // the card covers it all, so there's no payment page.
    await page.context().clearCookies();
    const mira = await customerAccount("mira");
    const perfume = await createTestProduct("giftcard");
    await page.goto(`/products/${perfume.slug}`);
    await addToBag(page);
    await page.goto("/checkout");
    await signInFromDrawer(page, mira);
    await expect(page.getByText(`Signed in as ${mira.email}`)).toBeVisible();
    await page.getByLabel("Mobile").fill("050 444 5566");
    await page.getByLabel("Emirate").click();
    await page.getByRole("option", { name: "Abu Dhabi" }).click();
    await page.getByLabel("Street address").fill("Villa 8, Street 2");
    await page.getByLabel("Area").fill("Khalifa City");
    await page.getByLabel("City").fill("Abu Dhabi");
    const fold = page.getByText("Show order summary");
    if (await fold.isVisible()) await fold.click();
    await page.getByRole("textbox", { name: "Gift card" }).locator("visible=true").fill(card!.code);
    await page.getByRole("button", { name: "Apply" }).locator("visible=true").nth(1).click();
    // Phones show the summary twice (folded at the top and above the button).
    await expect(page.getByText("To pay by card").locator("visible=true").first()).toBeVisible();
    await page.getByRole("checkbox", { name: /I agree to the/i }).check();
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });

    const { data: balance } = await admin.rpc("gift_card_balance", { p_card: card!.id });
    expect(balance).toBe(19_000); // AED 500 − AED 310
  });

  test("owner issues a card by hand and voids it", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/gift-cards/new");
    await page.getByLabel("Amount (AED)").fill("150");
    await page.getByLabel("Note (staff only)").fill("E2E goodwill");
    await page.getByLabel(/email the gift card/i).uncheck();
    await page.getByRole("button", { name: "Issue gift card" }).click();
    await expect(page.getByText("AED 150 gift card")).toBeVisible();
    await expect(page.getByText("Issued", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Void" }).click();
    await page.getByLabel("Reason").fill("Issued by mistake");
    await page.getByRole("button", { name: "Void gift card" }).click();
    await expect(page.getByText("Voided", { exact: true })).toBeVisible();
  });
});
