import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText, Mail, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings" };

/** Settings hub. Business settings (VAT, delivery fees…) join here in later milestones. */
export default async function SettingsPage() {
  const staff = await requireStaff();
  const sections = [
    {
      href: "/admin/settings/contact",
      title: "Contact details",
      description: "WhatsApp, email and Instagram shown on the Contact page and footer.",
      icon: MessageCircle,
      allowed: can(staff.permissions, "settings.manage"),
    },
    {
      href: "/admin/settings/help",
      title: "Help & policies",
      description: "Shipping, returns, passport terms, terms of service, privacy and cookies.",
      icon: FileText,
      allowed: can(staff.permissions, "settings.manage"),
    },
    {
      href: "/admin/settings/notifications",
      title: "Notifications",
      description: "Customer and owner emails: wording, on/off, test sends and the outbox.",
      icon: Mail,
      allowed: can(staff.permissions, "notifications.manage"),
    },
  ].filter((s) => s.allowed);
  if (!sections.length) redirect("/admin/forbidden?need=settings.manage");

  return (
    <>
      <PageHeader title="Settings" />
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="bg-card hover:border-burgundy/40 flex items-center gap-4 rounded-xl border p-5 transition-colors"
            >
              <span className="bg-pink text-burgundy flex size-11 shrink-0 items-center justify-center rounded-full">
                <s.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.title}</span>
                <span className="text-muted-foreground block text-sm">{s.description}</span>
              </span>
              <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
