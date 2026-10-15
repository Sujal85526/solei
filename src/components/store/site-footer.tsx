import Link from "next/link";
import { cacheLife } from "next/cache";
import { MapPin, Mail, MessageCircle } from "lucide-react";
import { InstagramIcon } from "@/components/brand/icons";
import { Logo, PostmarkWaves } from "@/components/brand";
import { storeNav } from "@/content/site";
import { formatPhone, waNumber } from "@/lib/phone";
import { getContactDetails } from "@/modules/settings/queries";
import { t } from "@/content/en";
import { SoonTag } from "./soon-tag";

/** Store footer; contact channels come from Admin → Settings → Contact details (only those set). */
export async function SiteFooter() {
  const contact = await getContactDetails();
  const link = "text-cream/85 hover:text-pink flex items-center gap-3 text-sm";
  return (
    <footer className="border-pink/10 bg-noir text-pearl border-t">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-16 sm:px-8 md:grid-cols-12 lg:px-12">
        <div className="flex flex-col gap-5 md:col-span-4">
          <Logo className="text-pink h-9 w-[5.45rem] self-start" />
          <p className="font-display text-xl italic">{t.brand.tagline}</p>
          <PostmarkWaves className="text-pink/40 w-32" />
        </div>
        <FooterColumn title={t.footer.explore} className="md:col-span-2">
          {storeNav.map((item) =>
            item.soon ? (
              <li key={item.href} className="text-cream/45 text-sm">
                {t.nav[item.key]} <SoonTag />
              </li>
            ) : (
              <FooterLink key={item.href} href={item.href}>
                {t.nav[item.key]}
              </FooterLink>
            ),
          )}
        </FooterColumn>
        <FooterColumn title={t.footer.help} className="md:col-span-3">
          <FooterLink href="/help">{t.footer.helpCentre}</FooterLink>
          <FooterLink href="/track">{t.nav.trackOrder}</FooterLink>
          <FooterLink href="/help?tab=shipping">{t.footer.policies.delivery}</FooterLink>
          <FooterLink href="/help?tab=returns">{t.footer.policies.returns}</FooterLink>
          <FooterLink href="/help?tab=privacy">{t.footer.policies.privacy}</FooterLink>
          <FooterLink href="/help?tab=terms">{t.footer.policies.terms}</FooterLink>
        </FooterColumn>
        <FooterColumn title={t.footer.contact} className="md:col-span-3">
          <li className="text-cream/85 flex items-start gap-3 text-sm">
            <MapPin className="text-pink mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
            {t.footer.location}
          </li>
          {contact.whatsapp ? (
            <li>
              <a
                href={`https://wa.me/${waNumber(contact.whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className={link}
              >
                <MessageCircle className="text-pink size-4 shrink-0" strokeWidth={1.5} />
                {formatPhone(contact.whatsapp)}
              </a>
            </li>
          ) : null}
          {contact.email ? (
            <li>
              <a href={`mailto:${contact.email}`} className={link}>
                <Mail className="text-pink size-4 shrink-0" strokeWidth={1.5} />
                {contact.email}
              </a>
            </li>
          ) : null}
          {contact.instagramHandle && contact.instagramUrl ? (
            <li>
              <a href={contact.instagramUrl} target="_blank" rel="noreferrer" className={link}>
                <InstagramIcon className="text-pink size-4 shrink-0" strokeWidth={1.5} />
                {contact.instagramHandle}
              </a>
            </li>
          ) : null}
        </FooterColumn>
      </div>
      <div className="border-cream/10 border-t">
        <div className="text-cream/70 mx-auto flex max-w-[90rem] flex-col gap-2 px-5 py-6 text-xs sm:flex-row sm:justify-between sm:px-8 lg:px-12">
          <p>
            © <CopyrightYear /> Solei. {t.footer.rights}
          </p>
          <p className="eyebrow text-pink/80 text-[0.65rem]">{t.brand.promise}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="eyebrow text-pink mb-5">{title}</h2>
      <ul className="flex flex-col gap-1">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-cream/85 hover:text-pink text-sm transition-colors">
        {children}
      </Link>
    </li>
  );
}

/** Cached so the static shell can prerender; refreshed daily. */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
