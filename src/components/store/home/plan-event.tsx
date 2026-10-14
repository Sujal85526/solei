import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { Container, Eyebrow, OrnamentDivider, Section } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

const services = [
  "Perfume display booth styled for your day",
  "Guest giveaways — perfumes, sprays and dukhoon",
  "Customised arrangements, florals in your colours",
];

export function PlanYourEvent({ eventTypes }: { eventTypes: readonly string[] }) {
  return (
    <Section tone="burgundy" aria-labelledby="events-title" className="relative overflow-hidden">
      <Container size="wide" className="grid items-center gap-14 lg:grid-cols-12">
        <div className="relative mx-auto w-full max-w-md lg:col-span-5">
          {/* Arch-shaped photo, echoing the profile's arch motif */}
          <div className="border-pink/30 relative aspect-[3/4] overflow-hidden rounded-t-full border p-2">
            <div className="relative h-full w-full overflow-hidden rounded-t-full">
              <Image
                src="/images/events/booth-florals.jpg"
                alt="A Solei display booth with pink florals, perfume bottles and passports"
                fill
                sizes="(min-width: 1024px) 34vw, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-7 lg:col-span-6 lg:col-start-7">
          <Eyebrow className="text-pink/90">Plan your event</Eyebrow>
          <h2 id="events-title" className="text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            Bring Solei <span className="italic">to your celebration.</span>
          </h2>
          <p className="text-cream/85 max-w-lg text-base leading-relaxed">
            A curated scent experience for your guests — a styled perfume booth, giveaways
            they&apos;ll keep and arrangements made around your day. Tell us about your event and
            we&apos;ll prepare a personal quotation.
          </p>
          <ul aria-label="Occasions" className="flex flex-wrap gap-2">
            {eventTypes.map((type) => (
              <li
                key={type}
                className="border-pink/40 text-pink rounded-full border px-4 py-1.5 text-sm"
              >
                {type}
              </li>
            ))}
          </ul>
          <OrnamentDivider className="text-gold max-w-sm" />
          <ul className="flex flex-col gap-3">
            {services.map((s) => (
              <li key={s} className="text-cream/90 flex items-start gap-3 text-sm">
                <Check className="text-pink mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
                {s}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link href="/events" className={buttonVariants({ size: "cta", variant: "secondary" })}>
              Plan your event
            </Link>
            <Link
              href="/events#packages"
              className={buttonVariants({ size: "cta", variant: "outline-light" })}
            >
              View packages
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
