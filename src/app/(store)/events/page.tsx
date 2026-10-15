import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { eventsCopy as c } from "@/content/events";

export const metadata: Metadata = {
  title: c.meta.title,
  description: c.meta.description,
};

/**
 * Event booking is locked until launch: the page is a "Coming soon" card. The booking wizard,
 * packages and quotes (`components/store/events`, `/events/quote/[token]`) stay in place.
 */
export default function EventsPage() {
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
