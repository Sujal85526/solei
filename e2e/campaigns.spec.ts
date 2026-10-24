import { createHash, createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, signInAsOwner } from "./helpers/auth";
import { localEnv } from "./helpers/env";

/** Same signing as src/modules/campaigns/links.ts with the derived secret. */
const unsubscribeToken = (customerId: string) => {
  const env = localEnv();
  const secret =
    env.CART_LINK_SECRET ||
    createHash("sha256").update(`unsubscribe:${env.SUPABASE_SECRET_KEY}`).digest("hex");
  return createHmac("sha256", secret)
    .update(`unsubscribe:${customerId}`)
    .digest("hex")
    .slice(0, 32);
};

test("segment → campaign to email opt-ins only → unsubscribe", async ({ page }) => {
  const admin = adminClient();
  const tag = Date.now().toString().slice(-7);
  const { data: optedIn } = await admin
    .from("customers")
    .insert({
      name: "Noura Optin",
      email: `camp.in.${tag}@solei.test`,
      emirate: "fujairah",
      marketing_consent: true,
      marketing_channels: ["email"],
    })
    .select("id, email")
    .single();
  const { data: notOptedIn } = await admin
    .from("customers")
    .insert({ name: "Reem Quiet", email: `camp.out.${tag}@solei.test`, emirate: "fujairah" })
    .select("id, email")
    .single();

  await signInAsOwner(page);

  // Segment: customers in Fujairah.
  await page.goto("/admin/campaigns/segments/new");
  await page.getByLabel("Name").fill(`Fujairah ${tag}`);
  await page.getByLabel("Fujairah").check();
  await expect(page.getByText("can get campaigns")).toBeVisible();
  await page.getByRole("button", { name: "Create segment" }).click();
  await expect(page.getByRole("heading", { name: `Fujairah ${tag}` })).toBeVisible();

  // Campaign draft → send.
  await page.goto("/admin/campaigns/new");
  await page.getByLabel("Name (staff only)").fill(`Fujairah launch ${tag}`);
  const segmentId = await page
    .locator("#segmentId option", { hasText: `Fujairah ${tag}` })
    .getAttribute("value");
  await page.getByLabel("Send to").selectOption(segmentId!);
  await page.getByLabel("Subject").fill("A new destination, {{first_name}}");
  await page.getByLabel("Message").fill("Dear {{first_name}},\n\nSantorini has landed.");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page.getByText("· Draft")).toBeVisible();
  await page.getByRole("button", { name: /^Send to \d+ customers?$/ }).click();
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/^Sent to \d+ customers?/)).toBeVisible({ timeout: 20_000 });

  const { data: campaign } = await admin
    .from("campaigns")
    .select("id, status")
    .eq("name", `Fujairah launch ${tag}`)
    .single();
  expect(campaign!.status).toBe("sent");
  const { data: recipients } = await admin
    .from("campaign_recipients")
    .select("email, status")
    .eq("campaign_id", campaign!.id);
  expect(recipients).toContainEqual({ email: optedIn!.email, status: "sent" });
  expect(recipients!.map((r) => r.email)).not.toContain(notOptedIn!.email);

  // Unsubscribe from the email's link.
  await page.goto(`/unsubscribe?c=${optedIn!.id}&t=${unsubscribeToken(optedIn!.id)}`);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed." })).toBeVisible();
  const { data: after } = await admin
    .from("customers")
    .select("marketing_consent, unsubscribed_at")
    .eq("id", optedIn!.id)
    .single();
  expect(after!.marketing_consent).toBe(false);
  expect(after!.unsubscribed_at).not.toBeNull();
});
