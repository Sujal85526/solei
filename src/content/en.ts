/**
 * UI copy dictionary (English). All user-facing strings for layout chrome live here so Arabic can be
 * added later as `ar.ts` with the same shape. Business content (products, destinations, packages,
 * loyalty rules) comes from the database, not from this file.
 */
export const en = {
  brand: {
    name: "Solei",
    tagline: "Made to remain.",
    promise: "A destination in scent.",
    invitation: "Every bottle is an invitation to remember a place differently.",
    collect: "Collect the destinations. Keep the memory.",
  },
  nav: {
    shop: "Shop",
    destinations: "Destinations",
    events: "Plan your event",
    passport: "Solei Passport",
    story: "Our story",
    cart: "Cart",
    menu: "Menu",
    closeMenu: "Close menu",
    trackOrder: "Track an order",
    skipToContent: "Skip to content",
  },
  footer: {
    location: "Abu Dhabi, United Arab Emirates",
    explore: "Explore",
    help: "Help",
    follow: "Follow",
    contact: "Contact",
    policies: {
      delivery: "Delivery",
      returns: "Returns & refunds",
      privacy: "Privacy",
      terms: "Terms",
    },
    rights: "All rights reserved.",
  },
  admin: {
    title: "Solei Admin",
    nav: {
      dashboard: "Dashboard",
      pos: "POS",
      orders: "Orders",
      products: "Products",
      inventory: "Inventory",
      customers: "Customers",
      calendar: "Calendar",
      bookings: "Bookings",
      loyalty: "Loyalty",
      reports: "Reports",
      staff: "Staff",
      settings: "Settings",
      activity: "Activity",
      more: "More",
      viewStore: "View store",
      signOut: "Sign out",
    },
  },
} as const;

export type Dictionary = typeof en;
export const t = en;
