/**
 * Staff logins kept off every staff list and picker in the admin (the developers' accounts). Their
 * access is unchanged and their actions still show in Activity. Edited here only, on purpose: there
 * is no admin setting for it.
 */
export const HIDDEN_STAFF_EMAILS: readonly string[] = [
  "rajputsujal098@gmail.com",
  "cityreachadmin@gmail.com",
];

export const isHiddenStaffEmail = (email: string | null | undefined) =>
  Boolean(email && HIDDEN_STAFF_EMAILS.includes(email.trim().toLowerCase()));
