/**
 * LOCAL DEVELOPMENT ONLY — demo staff accounts written into supabase/seed.sql.
 * Never run seed.sql against production.
 */
export const DEV_PASSWORD = "Solei-dev-2026";

/** Base32 TOTP secret for the seeded owner — add it to an authenticator app to sign in locally. */
export const DEV_OWNER_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

export const DEV_USERS = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    email: "owner@solei.test",
    name: "Noor (Owner)",
    role: "owner",
    totp: true,
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    email: "manager@solei.test",
    name: "Sara (Manager)",
    role: "manager",
    totp: false,
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    email: "sales@solei.test",
    name: "Omar (Sales)",
    role: "sales_staff",
    totp: false,
  },
] as const;
