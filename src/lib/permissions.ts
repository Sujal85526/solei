/**
 * Permission keys. The database is the source of truth at runtime (`permissions`,
 * `role_permissions`, `has_permission()`); this list mirrors the migrations that insert them
 * (`20261014000009_permissions_seed.sql` and later) and is kept in sync by `permissions.test.ts`.
 */
export const PERMISSIONS = {
  "dashboard.view": { group: "General", description: "See the dashboard" },
  "pos.use": { group: "Sales", description: "Use the event POS" },
  "orders.view": { group: "Sales", description: "View orders and payments" },
  "orders.create": { group: "Sales", description: "Create manual orders" },
  "orders.update": { group: "Sales", description: "Change order status, delivery and notes" },
  "orders.cancel": {
    group: "Sales",
    description: "Cancel orders (returns stock, reverses stamps)",
  },
  "orders.refund": { group: "Sales", description: "Record refunds" },
  "orders.price_override": { group: "Sales", description: "Override prices on manual orders" },
  "payments.record": { group: "Sales", description: "Record cash, transfer and terminal payments" },
  "payment_links.create": { group: "Sales", description: "Create and send payment links" },
  "coupons.manage": { group: "Sales", description: "Create, edit and pause discount coupons" },
  "catalog.view": { group: "Catalog", description: "View all products, including inactive" },
  "reviews.manage": { group: "Catalog", description: "Approve or decline customer reviews" },
  "catalog.manage": {
    group: "Catalog",
    description: "Create and edit products, prices and images",
  },
  "inventory.view": { group: "Inventory", description: "View stock levels and movements" },
  "inventory.receive": { group: "Inventory", description: "Receive stock" },
  "inventory.adjust": { group: "Inventory", description: "Record damage and corrections" },
  "inventory.transfer": { group: "Inventory", description: "Transfer stock between locations" },
  "customers.view": { group: "Customers", description: "View customers" },
  "customers.manage": { group: "Customers", description: "Create and edit customers" },
  "events.view": { group: "Events", description: "View the event calendar" },
  "events.manage": {
    group: "Events",
    description: "Create and edit events, expenses and documents",
  },
  "bookings.view": { group: "Events", description: "View booking requests" },
  "bookings.manage": { group: "Events", description: "Reply, quote, approve and reject bookings" },
  "loyalty.view": { group: "Loyalty", description: "View passports and stamps" },
  "loyalty.adjust": {
    group: "Loyalty",
    description: "Add or remove stamps manually, issue passports",
  },
  "loyalty.manage": { group: "Loyalty", description: "Change loyalty programme rules" },
  "reports.view": { group: "Reports", description: "View sales reports (units, revenue)" },
  "reports.financial.view": {
    group: "Reports",
    description: "See costs, COGS, expenses and profit",
  },
  "notifications.manage": { group: "Settings", description: "Edit notification templates" },
  "settings.manage": { group: "Settings", description: "Change business settings" },
  "staff.manage": {
    group: "Settings",
    description: "Manage staff accounts, roles and permissions",
  },
  "audit.view": { group: "Settings", description: "View the activity log" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

export type RoleKey = "owner" | "manager" | "sales_staff";

/** Launch defaults (editable by the owner in Admin → Staff → Roles). Owner implicitly has everything. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[] | "all"> = {
  owner: "all",
  manager: PERMISSION_KEYS.filter((k) => k !== "staff.manage"),
  sales_staff: [
    "dashboard.view",
    "pos.use",
    "orders.view",
    "orders.create",
    "payments.record",
    "payment_links.create",
    "catalog.view",
    "inventory.view",
    "customers.view",
    "customers.manage",
    "events.view",
    "bookings.view",
    "loyalty.view",
  ],
};

/** Permissions that expose costs/profit — never granted to sales staff by default. */
export const FINANCIAL_PERMISSIONS: PermissionKey[] = ["reports.financial.view"];

export function can(
  granted: ReadonlySet<string> | readonly string[] | "all",
  key: PermissionKey,
): boolean {
  if (granted === "all") return true;
  return Array.isArray(granted) ? granted.includes(key) : (granted as ReadonlySet<string>).has(key);
}
