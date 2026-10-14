/** Admin → Loyalty section tabs. */
export function loyaltyNav(canManage: boolean) {
  return [
    { href: "/admin/loyalty", label: "Overview" },
    ...(canManage ? [{ href: "/admin/loyalty/settings", label: "Settings" }] : []),
  ];
}
