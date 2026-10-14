import Link from "next/link";
import { cacheLife } from "next/cache";
import { MapPin, Mail } from "lucide-react";
import { InstagramIcon } from "@/components/brand/icons";
import { Logo, PostmarkWaves } from "@/components/brand";
import { siteDefaults, storeNav } from "@/content/site";
import { t } from "@/content/en";

export type FooterContact = {
  email?: string;
  whatsappUrl?: string;
  instagramHandle?: string;
  instagramUrl?: string;
};

export function SiteFooter({ contact = {} }: { contact?: FooterContact }) {
  const email = contact.email ?? siteDefaults.email;
  const igHandle = contact.instagramHandle ?? siteDefaults.instagram.handle;
  const igUrl = contact.instagramUrl ?? siteDefaults.instagram.url;
  return (
    <footer className="border-pink/10 bg-noir text-pearl border-t">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-16 sm:px-8 md:grid-cols-12 lg:px-12">
        <div className="flex flex-col gap-5 md:col-span-4">
          <Logo className="text-pink h-9 w-[5.45rem] self-start" />
          <p className="font-display text-xl italic">{t.brand.tagline}</p>
          <PostmarkWaves className="text-pink/40 w-32" />
        </div>
        <FooterColumn title={t.footer.explore} className="md:col-span-2">
          {storeNav.map((item) => (
            <FooterLink key={item.href} href={item.href}>
              {t.nav[item.key]}
            </FooterLink>
          ))}
        </FooterColumn>
        <FooterColumn title={t.footer.help} className="md:col-span-3">
          <FooterLink href="/track">{t.nav.trackOrder}</FooterLink>
          <FooterLink href="/policies/delivery">{t.footer.policies.delivery}</FooterLink>
          <FooterLink href="/policies/returns">{t.footer.policies.returns}</FooterLink>
          <FooterLink href="/policies/privacy">{t.footer.policies.privacy}</FooterLink>
          <FooterLink href="/policies/terms">{t.footer.policies.terms}</FooterLink>
        </FooterColumn>
        <FooterColumn title={t.footer.contact} className="md:col-span-3">
          <li className="text-cream/85 flex items-start gap-3 text-sm">
            <MapPin className="text-pink mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
            {t.footer.location}
          </li>
          <li>
            <a
              href={`mailto:${email}`}
              className="text-cream/85 hover:text-pink flex items-center gap-3 text-sm"
            >
              <Mail className="text-pink size-4 shrink-0" strokeWidth={1.5} />
              {email}
            </a>
          </li>
          <li>
            <a
              href={igUrl}
              target="_blank"
              rel="noreferrer"
              className="text-cream/85 hover:text-pink flex items-center gap-3 text-sm"
            >
              <InstagramIcon className="text-pink size-4 shrink-0" strokeWidth={1.5} />
              {igHandle}
            </a>
          </li>
          {contact.whatsappUrl ? (
            <li>
              <a href={contact.whatsappUrl} className="text-cream/85 hover:text-pink text-sm">
                WhatsApp
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
