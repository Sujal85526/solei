import type { Metadata } from "next";
import { BookingSettingsForm, ConfigEditor } from "@/components/admin/bookings/config-editor";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { SubNav } from "@/components/admin/sub-nav";
import { requirePagePermission } from "@/lib/auth/session";
import { getBookingSettings, listBookingConfig } from "@/modules/bookings/queries";

export const metadata: Metadata = { title: "Booking options" };

export default async function BookingSettingsPage() {
  await requirePagePermission("bookings.manage");
  const [config, settings] = await Promise.all([listBookingConfig(), getBookingSettings()]);
  return (
    <>
      <PageHeader
        title="Bookings"
        description="Everything customers choose from in “Plan your event”. Changes show on the website straight away."
      />
      <SubNav
        items={[
          { href: "/admin/bookings", label: "Inbox" },
          { href: "/admin/bookings/settings", label: "Packages & options" },
        ]}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <AdminSection title="Pricing & quotes">
          <BookingSettingsForm
            depositBp={settings.booking_deposit_bp}
            flowerBaseFils={settings.booking_flower_base_fils}
            validityDays={settings.booking_quote_validity_days}
          />
        </AdminSection>
        <ConfigEditor kind="package" title="Packages" noun="package" items={config.packages} />
        <ConfigEditor
          kind="booth"
          title="Booth designs"
          noun="booth design"
          items={config.booths}
        />
        <ConfigEditor kind="flower" title="Flower colours" noun="colour" items={config.flowers} />
        <ConfigEditor kind="service" title="Services" noun="service" items={config.services} />
        <ConfigEditor
          kind="eventType"
          title="Event types"
          noun="event type"
          items={config.eventTypes}
        />
      </div>
    </>
  );
}
