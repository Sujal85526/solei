/** Admin → Loyalty section tabs. */
export function loyaltyNav(canManage: boolean) {
  return [
    { href: "/admin/loyalty", label: "Overview" },
    { href: "/admin/loyalty/points", label: "Points & tiers" },
    ...(canManage ? [{ href: "/admin/loyalty/settings", label: "Settings" }] : []),
  ];
}
