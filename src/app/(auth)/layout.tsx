import type { Metadata } from "next";
import Image from "next/image";
import { Logo } from "@/components/brand";

export const metadata: Metadata = {
  title: { default: "Sign in", template: "%s · Solei Admin" },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="bg-noir relative hidden overflow-hidden lg:block">
        <Image
          src="/images/products/sprays-stone.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        {/* Soft fades so the logo (top) and tagline (bottom) stay readable on the photo. */}
        <div
          aria-hidden
          className="from-noir/70 to-noir/75 absolute inset-0 bg-gradient-to-b via-transparent via-45%"
        />
        <div className="text-cream absolute inset-0 flex flex-col justify-between p-12">
          <Logo className="text-pink h-10 self-start" />
          <p className="font-display max-w-sm text-3xl leading-snug italic">Made to remain.</p>
        </div>
      </div>
      <main id="main" className="bg-cream flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Logo className="text-burgundy mb-10 h-9 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
