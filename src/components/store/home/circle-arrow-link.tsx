import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Underlined label + round arrow — the homepage's one link style. Colours follow the section theme. */
export function CircleArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group text-primary inline-flex items-center gap-5 text-[0.65rem] tracking-[0.3em] uppercase",
        className,
      )}
    >
      <span className="border-primary/40 group-hover:border-primary border-b pb-1 transition-colors">
        {children}
      </span>
      <span className="border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground flex size-11 items-center justify-center rounded-full border transition-colors duration-300">
        <ArrowRight
          className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180"
          strokeWidth={1.25}
        />
      </span>
    </Link>
  );
}
