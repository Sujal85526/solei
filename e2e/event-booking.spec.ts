import { expect, test, type Page } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";

/*
 * Event booking happy path (BUILD_PROMPT §6.10): public wizard → admin quote → customer accepts
 * via the token page → deposit paid with the mock provider → booking confirmed + calendar event.
 * Runs on phone and desktop; tablet is covered by those two layouts.
 */

/** Far-future date per project so runs don't share a calendar day. */
const eventDate = (project: string) =>
  `2031-${{ mobile: "02", desktop: "03" }[project] ?? "04"}-14`;

const phoneFor = (project: string) =>
  `050 ${project === "mobile" ? "441" : "442"} ${String(Date.now()).slice(-4)}`;

async function pick(page: Page, name: RegExp | string) {
  await page.getByRole("radio", { name }).check({ force: true });
}

async function next(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("event booking", () => {
  test("request → quote → accept → deposit → confirmed on the calendar", async ({ page }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.setTimeout(120_000);
    const project = info.project.name;
    const email = `booking-${project}-${Date.now()}@solei.test`;

    // ─── Public wizard ────────────────────────────────────────────────────────────────────
    await page.goto("/events");
    await page.evaluate(() => localStorage.removeItem("solei.booking.draft.v1"));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: /Plan your/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Choose your/ })).toBeVisible();

    await next(page); // validation: nothing chosen yet
    await expect(page.getByText("Choose an option")).toBeVisible();
    await pick(page, "Wedding");
    await next(page);

    await expect(page.getByRole("heading", { name: "When and where?" })).toBeFocused();
    await page.getByLabel("Event date").fill(eventDate(project));
    await page.getByLabel("Number of guests").fill("120");
    await page.getByLabel("Start time").fill("18:00");
    await page.getByLabel("End time").fill("23:30");
    await page.getByLabel("Venue or area").fill("Emirates Palace");
    await page.getByLabel("Emirate").selectOption("abu_dhabi");
    await next(page);

    await page.getByRole("checkbox", { name: /Perfume display booth/ }).check({ force: true });
    await next(page);

    await pick(page, /^Signature/);
    await expect(page.getByText("Estimate so far")).toBeVisible();
    await next(page);

    await pick(page, /^Passport bar/);
    await next(page);

    await pick(page, /^Add flowers/);
    await pick(page, /^Burgundy/);
    await next(page);

    await page.getByLabel("Perfumes").fill("10");
    await next(page);

    // Draft survives a reload.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();

    await page.getByLabel("Full name").fill("Mariam E2E");
    await page.getByLabel("Mobile number").fill(phoneFor(project));
    await page.getByLabel("Email").fill(email);
    await page.getByRole("checkbox", { name: /Solei may contact me/ }).check();
    await next(page);

    // Signature 6,500 + flowers (800 base + 150 burgundy) + 10 perfumes × 280.
    await expect(page.getByTestId("estimate-total")).toContainText("AED 10,250");
    await page.getByRole("button", { name: "Send my request" }).click();
    await expect(page.getByRole("heading", { name: "Thank you." })).toBeVisible({
      timeout: 20_000,
    });
    const ref = (await page.getByText(/^BK-\d{4,}$/).textContent())!.trim();

    const admin = adminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select("id, status, estimated_total_fils")
      .eq("ref", ref)
      .single();
    expect(booking).toMatchObject({ status: "requested", estimated_total_fils: 1_025_000 });

    // ─── Admin: inbox → quote ─────────────────────────────────────────────────────────────
    await signInAsOwner(page);
    await page.goto("/admin/bookings");
    await page.getByRole("link", { name: new RegExp(ref) }).click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(ref) })).toBeVisible();
    await expect(page.getByTestId("quote-builder-total")).toHaveText("AED 10,250");
    await page.getByRole("button", { name: "Send quotation" }).click();
    const link = (await page.getByTestId("quote-link").textContent())!.trim();
    expect(link).toMatch(/\/events\/quote\/[0-9a-f]{64}$/);
    await expect(page.getByTestId("current-quote-link")).toHaveText(link);

    // ─── Customer: accept + pay the deposit ───────────────────────────────────────────────
    await page.goto(new URL(link).pathname);
    await expect(page.getByTestId("quote-total")).toHaveText("AED 10,250");
    await page.getByRole("button", { name: "Accept quotation" }).click();
    await expect(page.getByText("Quotation accepted.")).toBeVisible();
    await page.getByRole("button", { name: /Pay deposit · AED 5,125/ }).click();
    await expect(page.getByText("Test payment · no real card")).toBeVisible();
    await page.getByRole("button", { name: "Pay with test card" }).click();
    await expect(page.getByText("Your booking is confirmed.")).toBeVisible({ timeout: 30_000 });

    const { data: confirmed } = await admin
      .from("bookings")
      .select("status, event_id, events!bookings_event_id_fkey(type, status, booking_id)")
      .eq("id", booking!.id)
      .single();
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.events).toMatchObject({
      type: "private_booking",
      status: "confirmed",
      booking_id: booking!.id,
    });

    // ─── Admin sees the confirmation and the calendar link ────────────────────────────────
    await page.goto(`/admin/bookings/${booking!.id}`);
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: /On the calendar/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/calendar/events/${confirmed!.event_id}`));
  });
});
