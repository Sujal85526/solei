import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Logo } from "@/components/brand";
import { Toaster } from "@/components/ui/sonner";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Solei Admin" },
  robots: { index: false, follow: false },
};

/** Every admin route depends on the session; navigations block on the server by design. */
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

/** Reads the session (request-time) and renders the shell for a verified staff member. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  return (
    <AdminShell
      user={{ name: staff.name, role: staff.roleName, permissions: [...staff.permissions] }}
    >
      {children}
      <Toaster position="top-center" richColors />
    </AdminShell>
  );
}

function AdminLoading() {
  return (
    <div className="bg-pink flex min-h-dvh items-center justify-center">
      <Logo className="text-burgundy/40 h-8 animate-pulse" />
    </div>
  );
}
