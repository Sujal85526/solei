import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Solei Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Real session + permissions arrive with feat/admin-auth-staff.
  return (
    <AdminShell user={{ name: "Owner", role: "owner", permissions: "all" }}>{children}</AdminShell>
  );
}
