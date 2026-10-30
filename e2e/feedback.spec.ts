import { createHash, createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { localEnv } from "./helpers/env";

/** Same signing as src/modules/automation/links.ts with the derived secret (env.server.ts). */
const feedbackSecret = () =>
  localEnv().CART_LINK_SECRET ||
  createHash("sha256").update(`feedback-links:${localEnv().SUPABASE_SECRET_KEY}`).digest("hex");
const token = (orderId: string, purpose: "answer" | "stop") =>
  createHmac("sha256", feedbackSecret())
    .update(`feedback:${purpose}:${orderId}`)
    .digest("hex")
    .slice(0, 32);

/**
 * A customer with a delivered order whose "How was your order?" email went out — the row the
 * scheduler writes when it sends the request (service role).
 */
async function feedbackRequest(tag: string) {
  const admin = adminClient();
  const stamp = `${tag}.${Date.now()}`;
  const email = `feedback.${stamp}@example.com`;
  const { data: customer, error } = await admin
    .from("customers")
    .insert({ name: `E2E Feedback ${stamp}`, email, source: "website" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: order, error: e2 } = await admin
    .from("orders")
    .insert({
      customer_id: customer.id,
      channel: "whatsapp",
      status: "new",
      subtotal_fils: 28_000,
      total_fils: 28_000,
      contact_name: `E2E Feedback ${stamp}`,
      contact_email: email,
    })
    .select("id, number")
    .single();
  if (e2) throw e2;
  const { error: e3 } = await admin
    .from("feedback_requests")
    .insert({ order_id: order.id, customer_id: customer.id, email });
  if (e3) throw e3;
  return { customerId: customer.id as string, orderId: order.id as string, number: order.number };
}

test.describe("feedback after delivery", () => {
  test("the customer rates the order from the email link; it lands in the complaints log", async ({
    page,
    browser,
  }, info) => {
    test.slow();
    const req = await feedbackRequest(info.project.name);
    const message = `Lovely scent, but the box was dented (${info.project.name} ${Date.now()})`;

    // A forged link is refused.
    await page.goto(`/feedback?o=${req.orderId}&t=${"0".repeat(32)}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "This link isn't valid any more." }),
    ).toBeVisible();

    await page.goto(`/feedback?o=${req.orderId}&t=${token(req.orderId, "answer")}`);
    await expect(
      page.getByRole("heading", { level: 1, name: `How was order ${req.number}?` }),
    ).toBeVisible();
    // Nothing chosen: asks for a rating or a few words.
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Choose a rating or write a few words").first()).toBeVisible();
    await page.getByRole("radio", { name: "4 — Good" }).click();
    await expect(page.getByRole("radio", { name: "4 — Good" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByLabel("A complaint").check();
    await page.getByLabel("Anything you'd like to tell us?").fill(message);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Thank you." })).toBeVisible();

    const admin = adminClient();
    const { data: entry } = await admin
      .from("customer_feedback")
      .select("kind, source, rating, message, status, customer_id")
      .eq("order_id", req.orderId)
      .single();
    expect(entry).toMatchObject({
      kind: "complaint",
      source: "email",
      rating: 4,
      message,
      status: "open",
      customer_id: req.customerId,
    });

    // The same link again: already answered.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Thank you — we have your feedback." }),
    ).toBeVisible();

    // Staff find it in the log, marked as coming from the feedback email.
    const staff = await browser.newPage();
    await signInAsOwner(staff);
    await staff.goto("/admin/customers/feedback?kind=complaint&status=open");
    const item = staff
      .getByRole("list", { name: "Feedback" })
      .locator("visible=true")
      .getByRole("listitem")
      .filter({ hasText: message });
    await expect(item).toBeVisible();
    await expect(item.getByText(/from the feedback email/)).toBeVisible();
    await expect(item.getByLabel("4 out of 5")).toBeVisible();
    await expect(item.getByRole("link", { name: req.number })).toBeVisible();
    await staff.close();
  });

  test("the stop link turns feedback emails off; a forged one does nothing", async ({
    page,
  }, info) => {
    const req = await feedbackRequest(`stop.${info.project.name}`);
    const admin = adminClient();

    await page.goto(`/feedback/stop?o=${req.orderId}&t=${"0".repeat(32)}`);
    await page.getByRole("button", { name: "Stop feedback emails" }).click();
    // (Next's route announcer is an alert too.)
    await expect(
      page.getByRole("alert").filter({ hasText: "This link isn't valid any more." }),
    ).toBeVisible();
    const still = await admin
      .from("customers")
      .select("feedback_optout_at")
      .eq("id", req.customerId)
      .single();
    expect(still.data!.feedback_optout_at).toBeNull();

    // The real link: it takes the button (not the visit) to switch them off.
    await page.goto(`/feedback/stop?o=${req.orderId}&t=${token(req.orderId, "stop")}`);
    await expect(page.getByRole("heading", { level: 1, name: "Feedback emails" })).toBeVisible();
    await page.getByRole("button", { name: "Stop feedback emails" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Done." })).toBeVisible();
    await expect(page.getByText("We won't ask for feedback again.")).toBeVisible();
    const stopped = await admin
      .from("customers")
      .select("feedback_optout_at")
      .eq("id", req.customerId)
      .single();
    expect(stopped.data!.feedback_optout_at).not.toBeNull();

    // An answer token doesn't work as a stop token (purpose is part of the signature).
    const other = await feedbackRequest(`stop2.${info.project.name}`);
    await page.goto(`/feedback/stop?o=${other.orderId}&t=${token(other.orderId, "answer")}`);
    await page.getByRole("button", { name: "Stop feedback emails" }).click();
    // (Next's route announcer is an alert too.)
    await expect(
      page.getByRole("alert").filter({ hasText: "This link isn't valid any more." }),
    ).toBeVisible();
  });
});
