import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ContactForm } from "@/components/admin/settings/contact-form";
import { requirePagePermission } from "@/lib/auth/session";
import { getContactDetails } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Contact details" };

export default async function ContactSettingsPage() {
  await requirePagePermission("settings.manage");
  const contact = await getContactDetails();
  return (
    <>
      <PageHeader
        title="Contact details"
        description="Shown on the Contact page and in the footer. Only filled-in channels appear."
      />
      <ContactForm contact={contact} />
    </>
  );
}
