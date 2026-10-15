import Link from "next/link";
import type { CSSProperties } from "react";
import { storeNav } from "@/content/site";
import { t } from "@/content/en";
import { cn } from "@/lib/utils";
import { SoonTag } from "./soon-tag";

/**
 * The store menu's links (every page, then order tracking) — shared by the desktop dropdown and
 * the phone drawer so both always list the same pages. `--i` lets the drawer stagger them in.
 */
export function MenuLinks({
  onNavigate,
  itemClassName,
  dividerClassName = "mx-3",
}: {
  onNavigate: () => void;
  itemClassName: string;
  dividerClassName?: string;
}) {
  const links = storeNav.map((l) => ({ href: l.href, label: t.nav[l.key], soon: l.soon }));
  return (
    <nav aria-label="Menu">
      <ul>
        {links.map((link, i) => (
          <li key={link.href}>
            {link.soon ? (
              <span
                aria-disabled
                className={cn(itemClassName, "pointer-events-none opacity-50")}
                style={{ "--i": i } as CSSProperties}
              >
                {link.label} <SoonTag />
              </span>
            ) : (
              <Link
                href={link.href}
                onClick={onNavigate}
                className={itemClassName}
                style={{ "--i": i } as CSSProperties}
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className={cn("bg-pink/10 my-2 h-px", dividerClassName)} />
      <Link
        href="/track"
        onClick={onNavigate}
        className={itemClassName}
        style={{ "--i": links.length } as CSSProperties}
      >
        {t.nav.trackOrder}
      </Link>
    </nav>
  );
}
