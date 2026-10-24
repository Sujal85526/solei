import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BookingWizard } from "@/components/store/events/booking-wizard";
import { EventsHero } from "@/components/store/events/events-hero";
import { PackagesShowcase } from "@/components/store/events/packages-showcase";
import { buttonVariants } from "@/components/ui/button";
import { eventsCopy as c } from "@/content/events";
import { FEATURES } from "@/lib/features";
import { getBookingConfig } from "@/modules/bookings/queries";

export const metadata: Metadata = {
  title: c.meta.title,
  description: c.meta.description,
};

/**
 * Plan your event: hero, packages and the booking wizard. Until bookings launch on a deployment
 * (FEATURES.bookings) the page is a "Coming soon" card.
 */
export default async function EventsPage() {
  if (!FEATURES.bookings) return <ComingSoon />;
  const config = await getBookingConfig();
  const heroImage =
    config.booths[0]?.photos[0] ??
    config.packages[0]?.images[0] ??
    "/images/events/booth-florals.jpg";
  return (
    <div data-solid-header className="flex flex-col">
      <EventsHero eventTypes={config.eventTypes.map((t) => t.name)} image={heroImage} />
      <PackagesShowcase packages={config.packages} />
      {/* The planner on deep burgundy (pink headings, pearl text); its summary panels are blush. */}
      <section
        id="plan"
        aria-labelledby="plan-title"
        className="bg-burgundy-deep scroll-mt-16 py-20 sm:py-28"
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
    </div>
  );
}

function ComingSoon() {
  return (
    <section
      data-hero
      className="relative isolate flex min-h-[85svh] items-center justify-center overflow-hidden px-6 py-32 text-center"
    >
      <Image
        src="/images/events/booth-florals.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div className="bg-noir/70 absolute inset-0 -z-10" />
      <div className="flex max-w-xl flex-col items-center gap-6">
        <p className="eyebrow text-pink/80">{c.soon.eyebrow}</p>
        <h1 className="display text-5xl sm:text-7xl">
          {c.soon.title} <span className="italic">{c.soon.titleItalic}</span>
        </h1>
        <p className="border-pink/40 text-pink rounded-full border px-4 py-1.5 text-[0.65rem] tracking-[0.3em] uppercase">
          {c.soon.badge}
        </p>
        <p className="text-pearl/85 text-[0.95rem] leading-relaxed">{c.soon.lede}</p>
        <Link href="/shop" className={buttonVariants({ variant: "outline", className: "mt-2" })}>
          {c.soon.cta}
        </Link>
      </div>
    </section>
  );
}
