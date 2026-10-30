import { expect, test, type Page } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";

/*
 * Admin → Promotions → Banners (P2-69): the announcement bar above the header and a homepage card
 * under the hero. The test creates both through the admin, sees them on the shop, then hides and
 * deletes them so nobody else sees them.
 */

/** Today and tomorrow as UAE business dates (yyyy-mm-dd). */
function datesAroundToday() {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  return { today: day(new Date()), tomorrow: day(new Date(Date.now() + 86_400_000)) };
}

async function createBanner(
  page: Page,
  placement: "announcement" | "homepage",
  fields: { title?: string; body: string },
) {
  const { today, tomorrow } = datesAroundToday();
  await page.goto(`/admin/promotions/banners/new?placement=${placement}`);
  await expect(page.getByRole("heading", { level: 1, name: "New banner" })).toBeVisible();
  const label = placement === "homepage" ? "Homepage banner" : "Announcement bar";
  await expect(page.getByRole("radio", { name: new RegExp(`^${label}`) })).toBeChecked();
  if (fields.title) await page.getByRole("textbox", { name: /^Title/ }).fill(fields.title);
  await page
    .getByRole("textbox", { name: placement === "homepage" ? /^Text/ : /^Message/ })
    .fill(fields.body);
  await page.getByRole("checkbox", { name: /Only between certain dates/ }).check();
  await page.getByLabel("Starts on").fill(today);
  await page.getByLabel("Ends on").fill(tomorrow);
  // Phones show only the first announcement; the visitor check uses toBeAttached for that.
  await page.getByRole("textbox", { name: /^Order/ }).fill("0");
  await expect(page.getByRole("checkbox", { name: /^Showing/ })).toBeChecked();
  await page.getByRole("button", { name: "Create banner" }).click();
  await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/promotions\/banners\/[0-9a-f-]{36}/);
  return page.url().split("?")[0];
}

/** On the banner's admin page: hide it, then delete it. */
async function hideAndDelete(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Hide", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Hide" }).click();
  await expect(page.getByText("Banner hidden.")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/admin\/promotions\/banners$/);
}

test.describe("promotion banners", () => {
  const bodies: string[] = [];

  // If the test stops half-way, don't leave its banners on the shop.
  test.afterAll(async () => {
    if (bodies.length) await adminClient().from("promo_banners").delete().in("body", bodies);
  });

  test("owner shows an announcement bar and a homepage banner, then takes them down", async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const stamp = `${info.project.name} ${Date.now()}`;
    const announcement = `E2E free delivery this week ${stamp}`;
    const title = `E2E The winter edit ${stamp}`;
    const card = `E2E New scents for the cooler months ${stamp}`;
    bodies.push(announcement, card);

    await signInAsOwner(page);
    const barUrl = await createBanner(page, "announcement", { body: announcement });
    const cardUrl = await createBanner(page, "homepage", { title, body: card });

    const { data } = await adminClient()
      .from("promo_banners")
      .select("placement, title, active, starts_at, ends_at")
      .in("body", [announcement, card])
      .order("placement");
    expect(data).toHaveLength(2);
    expect(data!.every((b) => b.active && b.starts_at && b.ends_at)).toBe(true);

    // A visitor sees both: the bar on every page, the card under the homepage hero.
    const shopper = await browser.newPage();
    await shopper.goto("/");
    await expect(shopper.getByText(announcement)).toBeAttached();
    const promotions = shopper.getByRole("region", { name: "Promotions" });
    await expect(promotions.getByRole("heading", { name: title })).toBeVisible();
    await expect(promotions.getByText(card)).toBeVisible();
    await shopper.goto("/shop");
    await expect(shopper.getByText(announcement)).toBeAttached();

    // Taken down: gone from the shop straight away.
    await hideAndDelete(page, barUrl);
    await hideAndDelete(page, cardUrl);
    await shopper.goto("/");
    await expect(shopper.getByText(announcement)).toHaveCount(0);
    await expect(shopper.getByText(card)).toHaveCount(0);
    await shopper.close();

    const { count } = await adminClient()
      .from("promo_banners")
      .select("id", { count: "exact", head: true })
      .in("body", [announcement, card]);
    expect(count).toBe(0);
  });
});
