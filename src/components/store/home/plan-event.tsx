import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";

const services = [
  {
    title: "Perfume display booth",
    text: "A styled scent bar for your guests to discover every destination.",
  },
  { title: "Guest giveaways", text: "Perfumes, sprays and dukhoon your guests take home." },
  {
    title: "Customised arrangements",
    text: "Florals and details in your colours, made around your day.",
  },
];

/** Private events — kept prominent on the homepage (BUILD_PROMPT §6.1). */
export function PlanYourEvent({
  eventTypes,
  image,
}: {
  eventTypes: readonly string[];
  image: string;
}) {
  return (
    <section
      aria-labelledby="events-title"
      className="bg-burgundy relative overflow-hidden py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-[96rem] items-center gap-14 px-6 sm:px-10 lg:grid-cols-12 lg:gap-20 lg:px-14">
        <div className="relative mx-auto w-full max-w-md lg:col-span-5">
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full">
            <Parallax from="-5%" to="5%" scale={1.1} className="absolute inset-0">
              <ShimmerImage
                src={image}
                alt="A Solei perfume booth dressed with pink and burgundy florals"
                fill
                tone="dark"
                sizes="(min-width: 1024px) 34vw, 90vw"
                className="object-cover"
              />
            </Parallax>
          </div>
          <span
            aria-hidden
            className="border-pink/25 pointer-events-none absolute -inset-3 rounded-t-full border"
          />
        </div>

        <Reveal className="lg:col-span-7">
          <p className="eyebrow text-pink/70">Private events</p>
          <h2 id="events-title" className="display mt-5 text-5xl sm:text-6xl lg:text-7xl">
            Bring Solei <span className="block italic">to your celebration.</span>
          </h2>
          <p className="text-pearl/85 mt-8 max-w-lg text-[0.95rem] leading-relaxed">
            A curated scent experience for weddings, engagements, corporate evenings and family
            moments. Tell us about your day and we&apos;ll prepare a personal quotation.
          </p>
          <ul aria-label="Occasions" className="mt-8 flex flex-wrap gap-2">
            {eventTypes.map((type) => (
              <li
                key={type}
                className="border-pink/30 text-pink border px-4 py-2 text-[0.65rem] tracking-[0.22em] uppercase"
              >
                {type}
              </li>
            ))}
          </ul>
          <ul className="border-pink/15 mt-10 grid gap-6 border-t pt-8 sm:grid-cols-3">
            {services.map((s) => (
              <li key={s.title}>
                <p className="font-display text-pink text-xl">{s.title}</p>
                <p className="text-pearl/70 mt-2 text-sm leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="group bg-pink text-burgundy hover:bg-pearl inline-flex h-12 items-center gap-4 px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
            >
              Plan your event
              <ArrowRight
                className="size-3.5 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                strokeWidth={1.25}
              />
            </Link>
            <Link
              href="/events#packages"
              className="border-pink/40 text-pink hover:border-pink inline-flex h-12 items-center border px-7 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
            >
              View packages
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
