import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CinematicImage } from "@/components/motion/cinematic-image";
import { Reveal } from "@/components/motion/reveal";
import { SplitHeading } from "@/components/motion/split-heading";
import { contactCopy as c } from "@/content/contact";
import { formatPhone, waNumber } from "@/lib/phone";
import { getContactDetails } from "@/modules/settings/queries";

export const metadata: Metadata = { title: c.meta.title, description: c.meta.description };

/**
 * Contact: the brand's own words, then only the confirmed channels (owner-editable in
 * Admin → Settings → Contact details). No map — Solei has no shop; pop-ups are announced on Instagram.
 */
export default async function ContactPage() {
  const contact = await getContactDetails();
  type Channel = { label: string; value: string; href: string; external: boolean };
  const channels = [
    contact.whatsapp && {
      label: c.whatsapp,
      value: formatPhone(contact.whatsapp),
      href: `https://wa.me/${waNumber(contact.whatsapp)}`,
      external: true,
    },
    contact.email && {
      label: c.email,
      value: contact.email,
      href: `mailto:${contact.email}`,
      external: false,
    },
    contact.instagramHandle &&
      contact.instagramUrl && {
        label: c.instagram,
        value: contact.instagramHandle,
        href: contact.instagramUrl,
        external: true,
      },
  ].filter(Boolean) as Channel[];

  return (
    <section aria-labelledby="contact-title" className="on-blush">
      <div className="mx-auto grid max-w-[96rem] items-center gap-14 px-6 pt-14 pb-24 sm:px-10 sm:pt-20 lg:grid-cols-12 lg:gap-20 lg:px-14 lg:pb-32">
        <div className="lg:col-span-6">
          <Reveal as="p" className="eyebrow text-primary/70">
            {c.eyebrow}
          </Reveal>
          <SplitHeading
            as="h1"
            id="contact-title"
            lines={[...c.title]}
            className="mt-5 text-5xl sm:text-6xl lg:text-7xl"
          />
          <Reveal delay={250}>
            <span aria-hidden className="bg-primary/40 mt-8 block h-px w-12" />
            <p className="text-foreground/80 mt-8 max-w-md text-[0.95rem] leading-relaxed">
              {c.lede}
            </p>

            <ul className="divide-burgundy/15 border-burgundy/15 mt-12 max-w-lg divide-y border-y">
              {channels.map((ch) => (
                <li key={ch.label}>
                  <a
                    href={ch.href}
                    {...(ch.external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="group flex items-center justify-between gap-6 py-5"
                  >
                    <span className="eyebrow text-burgundy/60 w-28 shrink-0 text-[0.62rem]">
                      {ch.label}
                    </span>
                    <span className="font-display text-burgundy min-w-0 flex-1 truncate text-2xl transition-opacity group-hover:opacity-75 sm:text-3xl">
                      {ch.value}
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      strokeWidth={1.25}
                      className="text-burgundy/50 group-hover:text-burgundy size-5 shrink-0 transition-[color,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100"
                    />
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex max-w-lg flex-col gap-2">
              <p className="eyebrow text-burgundy/60 text-[0.62rem]">{c.popups}</p>
              <p className="text-foreground/75 text-sm leading-relaxed">{c.popupsBody}</p>
            </div>
            <Link
              href="/track"
              className="eyebrow text-burgundy mt-8 inline-block text-[0.65rem] underline-offset-[6px] hover:underline"
            >
              {c.track} →
            </Link>
          </Reveal>
        </div>

        <div className="lg:col-span-5 lg:col-start-8">
          <div className="arch relative mx-auto aspect-[4/5] w-full max-w-md">
            <CinematicImage
              src="/images/editorial/soho-portrait.jpg"
              alt="A woman in warm evening light holding a Solei all-over spray"
              sizes="(min-width: 1024px) 36vw, 90vw"
              drift="4%"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
