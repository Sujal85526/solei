import { expect, test } from "@playwright/test";
import {
  createStaffUser,
  latestEmailLink,
  mailpitAvailable,
  enrolTotp,
  ensureMfaRole,
  MFA_ROLE,
  signIn,
  signInAsOwner,
  signInAsSales,
} from "./helpers/auth";
import { totp } from "./helpers/totp";

test.describe("admin authentication", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders/);
  });

  test("wrong password is refused without saying which part was wrong", async ({ page }) => {
    await signIn(page, "owner@solei.test", "not-the-password-1");
    await expect(page.locator("form [role=alert]")).toContainText("don't match an active account");
  });

  test("a role that requires two-factor must pass TOTP before reaching the admin", async ({
    page,
  }, info) => {
    await ensureMfaRole();
    const owner = await enrolTotp(await createStaffUser(MFA_ROLE, info.project.name));
    await signIn(page, owner.email);
    await expect(page).toHaveURL(/\/admin\/mfa/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/mfa/);
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText("That code didn't work")).toBeVisible();
    await page.goto("/admin/login");
    await signInAsOwner(page, owner);
  });

  test("a new member of a two-factor role is made to enrol TOTP", async ({ page }, info) => {
    await ensureMfaRole();
    const manager = await createStaffUser(MFA_ROLE, info.project.name);
    await signIn(page, manager.email);
    await expect(page.getByRole("heading", { name: "Protect your account" })).toBeVisible();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    await page.getByLabel("6-digit code").fill(totp(secret));
    await page.getByRole("button", { name: "Turn on two-factor" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Hello/ })).toBeVisible();
  });

  test("sales staff work without MFA but can't open staff or activity", async ({ page }) => {
    await signInAsSales(page);
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Not available for your role" })).toBeVisible();
    await page.goto("/admin/activity");
    await expect(page.getByRole("heading", { name: "Not available for your role" })).toBeVisible();
  });
});

test.describe("staff management", () => {
  test("owner invites a team member who sets a password, then deactivation locks them out", async ({
    browser,
    page,
  }, info) => {
    test.skip(!(await mailpitAvailable()), "follows the invite email: needs local Mailpit");
    test.slow();
    const stamp = `${info.project.name}-${Date.now()}`;
    const email = `e2e-invite-${stamp}@solei.test`;
    const name = `Hessa ${stamp}`;
    await signInAsOwner(page);
    await page.goto("/admin/staff");
    await page.getByRole("button", { name: "Invite staff" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(name);
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Role").selectOption({ label: "Sales staff" });
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("Invitation sent.")).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

    // The invitee follows the email link in their own browser.
    const link = await latestEmailLink(email);
    const invitee = await browser.newContext();
    const p2 = await invitee.newPage();
    await p2.goto(link);
    await expect(p2.getByRole("heading", { name: "Choose a password" })).toBeVisible();
    await p2.getByLabel("New password").fill("Hessa-pass-2026");
    await p2.getByLabel("Confirm password").fill("Hessa-pass-2026");
    await p2.getByRole("button", { name: "Save password" }).click();
    await expect(p2.getByRole("heading", { level: 1, name: /^Hello/ })).toBeVisible();

    // Owner deactivates; the invitee loses access on the next request.
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("Account deactivated")).toBeVisible();

    await p2.goto("/admin");
    await expect(p2).toHaveURL(/\/admin\/login/);
    await invitee.close();

    // Both events are in the activity log.
    await page.goto("/admin/activity");
    await expect(page.getByText("staff_profiles.insert").first()).toBeVisible();
    await expect(page.getByText("auth.login").first()).toBeVisible();
  });

  test("owner creates a role, grants a permission and deletes the role", async ({ page }, info) => {
    const roleName = `Event lead ${info.project.name} ${Date.now()}`;
    await signInAsOwner(page);
    await page.goto("/admin/staff/roles");
    await page.getByRole("button", { name: "New role" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(roleName);
    await dialog.getByLabel("Start from").selectOption({ label: "Copy Sales staff" });
    await dialog.getByRole("button", { name: "Create role" }).click();
    await expect(page.getByText("Role created.")).toBeVisible();

    const card = page.getByRole("region", { name: new RegExp(roleName) });
    await expect(card.getByLabel("Use the event POS")).toBeChecked();
    await card.getByLabel("View sales reports (units, revenue)").check();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Permissions updated.")).toBeVisible();

    await card.getByRole("button", { name: `Delete ${roleName}` }).click();
    await expect(page.getByText("Role deleted.")).toBeVisible();
    await expect(card).toHaveCount(0);
  });
});
