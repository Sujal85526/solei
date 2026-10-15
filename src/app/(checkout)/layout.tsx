import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/brand";
import { t } from "@/content/en";

/** Checkout: a calm, light page with only the logo and a secure note — no store navigation. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light flex min-h-dvh flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-10">
          <Link href="/" aria-label="Solei — home">
            <Logo className="text-burgundy h-7" title="" />
          </Link>
          <p className="text-muted-foreground flex items-center gap-2 text-[0.65rem] tracking-[0.25em] uppercase">
            <Lock className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t.checkout.secure}
          </p>
        </div>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
