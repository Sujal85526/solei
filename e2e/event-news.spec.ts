import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";

test.describe("event news", () => {
  test("a visitor signs up for event news; staff see and change it on the profile", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.slow();
    const email = `event.news.${info.project.name}.${Date.now()}@example.com`;
    const name = `E2E Event News ${info.project.name} ${Date.now()}`;

    // Public sign-up.
    await page.goto("/event-news");
    await expect(page.getByRole("heading", { level: 1, name: "Meet us in person" })).toBeVisible();
    const form = page.locator("form", {
      has: page.getByRole("button", { name: "Keep me posted" }),
    });
    await form.getByRole("button", { name: "Keep me posted" }).click();
    await expect(form.getByText("Enter a valid email")).toBeVisible();
    await form.getByLabel("Your name").fill(name);
    await form.getByLabel("Email").fill(email.toUpperCase());
    await form.getByRole("button", { name: "Keep me posted" }).click();
    await expect(page.getByText("You're on the list.")).toBeVisible();

    const admin = adminClient();
    const { data: customer } = await admin
      .from("customers")
      .select("id, name, event_news, event_news_at")
      .eq("email", email)
      .single();
    expect(customer).toMatchObject({ name, event_news: true });
    expect(customer!.event_news_at).not.toBeNull();

    // Staff: the profile says so; take them off and put them back.
    await signInAsOwner(page);
    await page.goto(`/admin/customers/${customer!.id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText(/^Gets event news since/)).toBeVisible();
    await page.getByRole("button", { name: "Stop event news" }).click();
    await expect(page.getByText("Removed from event news.")).toBeVisible();
    await expect(page.getByText("Not on the event news list.")).toBeVisible();
    const off = await admin.from("customers").select("event_news").eq("id", customer!.id).single();
    expect(off.data!.event_news).toBe(false);

    await page.getByRole("button", { name: "Add to event news" }).click();
    await expect(page.getByText("Added to event news.")).toBeVisible();
    await expect(page.getByText(/^Gets event news since/)).toBeVisible();
    const on = await admin.from("customers").select("event_news").eq("id", customer!.id).single();
    expect(on.data!.event_news).toBe(true);
  });

  test("Announce on a calendar event writes a draft email to event news subscribers", async ({
    page,
  }, info) => {
    test.skip(info.project.name === "tablet", "phone + desktop only");
    test.slow();
    const admin = adminClient();
    const name = `E2E Announce ${info.project.name} ${Date.now()}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    const { data: event, error } = await admin
      .from("events")
      .insert({
        name,
        type: "popup",
        status: "confirmed",
        start_date: today,
        end_date: today,
        location: "Galleria Mall",
      })
      .select("id")
      .single();
    if (error) throw error;
    // At least one subscriber of our own.
    const { error: e2 } = await admin.rpc("event_news_opt_in", {
      p_email: `announce.${info.project.name}.${Date.now()}@example.com`,
      p_name: "E2E Subscriber",
    });
    if (e2) throw e2;

    await signInAsOwner(page);
    await page.goto(`/admin/calendar/events/${event.id}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByRole("button", { name: "Announce" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Write the email" }).click();

    await expect(page).toHaveURL(/\/admin\/campaigns\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name: `Event: ${name}` })).toBeVisible();
    await expect(page.getByText(/customers who asked for event news \(\d+\)/)).toBeVisible();

    const { data: campaign } = await admin
      .from("campaigns")
      .select("id, status, audience, event_id, subject, body")
      .eq("event_id", event.id)
      .single();
    expect(campaign).toMatchObject({ status: "draft", audience: "event_news", event_id: event.id });
    // Event details are filled in; the per-customer name stays a variable.
    expect(`${campaign!.subject}\n${campaign!.body}`).toContain(name);
    expect(campaign!.body).not.toContain("{{event_name}}");
    await expect(page.getByRole("link", { name: /Campaigns/ }).first()).toBeVisible();

    // Leave no draft behind for the owner.
    await admin.from("campaigns").delete().eq("id", campaign!.id);
  });
});
