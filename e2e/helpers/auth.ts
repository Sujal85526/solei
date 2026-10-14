import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localEnv, MAILPIT_URL } from "./env";
import { totp } from "./totp";

export const DEV_PASSWORD = "Solei-dev-2026";
export const OWNER = { email: "owner@solei.test", totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };
export const SALES = { email: "sales@solei.test" };

export function adminClient() {
  const env = localEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false },
    },
  );
}

export async function signIn(page: Page, email: string, password = DEV_PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export type TotpUser = { id: string; email: string; totpSecret: string };

/**
 * A fresh owner with an enrolled TOTP factor. Tests must not share one owner account:
 * GoTrue revokes a user's other aal1 sessions when MFA verification succeeds, so parallel
 * logins of the same owner would sign each other out.
 */
export async function createOwnerWithTotp(tag: string): Promise<TotpUser> {
  const { id, email } = await createStaffUser("owner", tag);
  const env = localEnv();
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (error) throw error;
  const { data: enrolled, error: e2 } = await client.auth.mfa.enroll({ factorType: "totp" });
  if (e2) throw e2;
  const { error: e3 } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: totp(enrolled.totp.secret),
  });
  if (e3) throw e3;
  return { id, email, totpSecret: enrolled.totp.secret };
}

/** Owner sign-in including the TOTP step (creates a dedicated owner unless one is given). */
export async function signInAsOwner(page: Page, owner?: TotpUser) {
  const who = owner ?? (await createOwnerWithTotp(`p${process.pid}`));
  await signIn(page, who.email);
  await expect(page.getByRole("heading", { name: "Verify it's you" })).toBeVisible();
  await page.getByLabel("6-digit code").fill(totp(who.totpSecret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
}

export async function signInAsSales(page: Page) {
  await signIn(page, SALES.email);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
}

/** Create a throwaway staff user directly (for tests that mutate state). */
export async function createStaffUser(role: "owner" | "manager" | "sales_staff", tag: string) {
  const admin = adminClient();
  const email = `e2e-${role}-${tag}-${Date.now()}@solei.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const { data: r } = await admin.from("roles").select("id").eq("key", role).single();
  const { error: e2 } = await admin
    .from("staff_profiles")
    .insert({ user_id: data.user.id, full_name: `E2E ${role}`, email, role_id: r!.id });
  if (e2) throw e2;
  return { id: data.user.id, email };
}

/** Find the newest email to `to` in Mailpit and return the first link matching `pattern`. */
export async function latestEmailLink(to: string, pattern = /\/auth\/confirm\?[^"'\s]+/) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await res.json()) as { messages?: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)
      ).json()) as { HTML: string };
      const match = msg.HTML.match(pattern);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email with a link for ${to}`);
}
