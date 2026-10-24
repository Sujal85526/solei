/**
 * Features that are built but not launched everywhere yet. Each is switched on per deployment by
 * an environment variable (read at build time), so one branch can preview a feature while the live
 * site keeps it locked.
 */
export const FEATURES = {
  /**
   * "Plan your event" — booking requests, quotes and deposits. `NEXT_PUBLIC_FEATURE_BOOKINGS=1`
   * opens it (storefront and admin); unset = "Coming soon".
   */
  bookings: process.env.NEXT_PUBLIC_FEATURE_BOOKINGS === "1",
} as const;
