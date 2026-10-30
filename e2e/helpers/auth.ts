import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { localEnv, MAILPIT_URL } from "./env";
import { totp } from "./totp";

export const DEV_PASSWORD = "Solei-dev-2026";

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
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export type TotpUser = { id: string; email: string; totpSecret: string };

/**
 * A fresh owner with an enrolled TOTP factor. Tests must not share one owner account:
 * GoTrue revokes a user's other aal1 sessions when MFA verification succeeds, so parallel
 * logins of the same owner would sign each other out.
 */
export async function createOwnerWithTotp(tag: string): Promise<TotpUser> {
  return enrolTotp(await createStaffUser("owner", tag));
}

/** Enrol and verify a TOTP factor for a staff user, as the MFA page does. */
export async function enrolTotp({ id, email }: { id: string; email: string }): Promise<TotpUser> {
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
  // The TOTP step only shows while the owner role requires two-factor (Staff → Roles).
  const verify = page.getByRole("heading", { name: "Verify it's you" });
  const hello = page.getByRole("heading", { level: 1, name: /^Hello/ });
  await expect(verify.or(hello)).toBeVisible();
  if (await verify.isVisible()) {
    await page.getByLabel("6-digit code").fill(totp(who.totpSecret));
    await page.getByRole("button", { name: "Verify" }).click();
  }
  await expect(hello).toBeVisible();
}

/** Sign in as a throwaway sales-staff user (no MFA for that role). */
export async function signInAsSales(page: Page) {
  const { email } = await createStaffUser("sales_staff", `s${process.pid}`);
  await signIn(page, email);
  await expect(page.getByRole("heading", { level: 1, name: /^Hello/ })).toBeVisible();
}

/**
 * A test role that requires two-factor sign-in (Staff → Roles). Owner and manager don't on the
 * live shop, so the MFA flow is tested with this role instead. Created once, reused.
 */
export const MFA_ROLE = "e2e_mfa";
export async function ensureMfaRole() {
  const { error } = await adminClient()
    .from("roles")
    .upsert(
      { key: MFA_ROLE, name: "E2E two-factor", requires_mfa: true },
      { onConflict: "key", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Create a throwaway staff user directly (for tests that mutate state). */
export async function createStaffUser(
  role: "owner" | "manager" | "sales_staff" | typeof MFA_ROLE,
  tag: string,
) {
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

/**
 * True when a local Mailpit catches the auth emails (local Supabase). A hosted test project sends
 * real emails instead (and refuses @solei.test addresses), so flows that follow an email link can't
 * run against it.
 */
export async function mailpitAvailable() {
  try {
    return (await fetch(`${MAILPIT_URL}/api/v1/info`, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
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
