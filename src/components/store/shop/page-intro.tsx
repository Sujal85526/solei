import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Eyebrow, PostmarkWaves } from "@/components/brand";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";

/** Quiet editorial page opener for listing pages: eyebrow, display title, italic lede. */
export function PageIntro({
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden pt-14 pb-10 sm:pt-20 sm:pb-14", className)}>
      <PostmarkWaves
        className="pointer-events-none absolute end-[-2rem] top-10 hidden w-56 opacity-60 md:block"
        lines={5}
        width={220}
      />
      <Container size="wide" className="flex flex-col gap-5">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="max-w-3xl text-5xl leading-[1.02] sm:text-6xl lg:text-7xl">{title}</h1>
        {lede ? (
          <p className="font-display text-ink/85 max-w-xl text-lg leading-relaxed italic sm:text-xl">
            {lede}
          </p>
        ) : null}
        {children}
      </Container>
    </header>
  );
}

export type Crumb = { href?: string; label: string };

/** Breadcrumb trail; the last crumb is the current page. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label={t.shop.breadcrumb} className={className}>
      <ol className="text-ink-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tracking-[0.18em] uppercase">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? (
              <span aria-hidden className="text-gold">
                /
              </span>
            ) : null}
            {c.href ? (
              <Link href={c.href} className="hover:text-burgundy transition-colors">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-burgundy">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
