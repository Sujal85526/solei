import type { Metadata } from "next";
import { BookingWizard } from "@/components/store/events/booking-wizard";
import { EventsHero } from "@/components/store/events/events-hero";
import { PackagesShowcase } from "@/components/store/events/packages-showcase";
import { eventsCopy as c } from "@/content/events";
import { getBookingConfig } from "@/modules/bookings/queries";

export const metadata: Metadata = {
  title: c.meta.title,
  description: c.meta.description,
};

export default async function EventsPage() {
  const config = await getBookingConfig();
  const heroImage =
    config.booths[0]?.photos[0] ??
    config.packages[0]?.images[0] ??
    "/images/events/booth-florals.jpg";
  return (
    <>
      <EventsHero eventTypes={config.eventTypes.map((t) => t.name)} image={heroImage} />
      <PackagesShowcase packages={config.packages} />
      <section
        id="plan"
        aria-labelledby="plan-title"
        className="border-pink/10 scroll-mt-20 border-t py-20 sm:py-28"
      >
        <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
          <div className="max-w-2xl">
            <p className="eyebrow text-pink/70">{c.wizard.eyebrow}</p>
            <h2 id="plan-title" className="display mt-5 text-5xl sm:text-6xl">
              {c.wizard.title} <span className="italic">{c.wizard.titleItalic}</span>
            </h2>
            <p className="text-pearl/80 mt-6 text-[0.95rem] leading-relaxed">{c.wizard.lede}</p>
          </div>
          <div className="mt-12">
            <BookingWizard config={config} />
          </div>
        </div>
      </section>
    </>
  );
}
