/**
 * Fallback site details. Owner-editable values (contact, socials, policies) are read from the
 * `settings` table once it exists; these defaults are used until then and in tests.
 */
export const siteDefaults = {
  instagram: { handle: "@solei.ad", url: "https://www.instagram.com/solei.ad/" },
  email: "hello@solei.ae",
  whatsapp: "", // owner sets their WhatsApp number in Admin → Settings
  city: "Abu Dhabi",
  country: "UAE",
} as const;

export const storeNav = [
  { href: "/shop", key: "shop" },
  { href: "/destinations", key: "destinations" },
  { href: "/events", key: "events" },
  { href: "/passport", key: "passport" },
] as const;
