import type { Metadata } from "next";
import Image from "next/image";
import { Logo } from "@/components/brand";

export const metadata: Metadata = {
  title: { default: "Sign in", template: "%s · Solei Admin" },
  robots: { index: false, follow: false },
};

const SLIDES = [
  { src: "/images/products/sprays-stone.jpg", position: "50% 45%" },
  { src: "/images/editorial/soho-portrait.jpg", position: "45% 40%" },
  { src: "/images/editorial/hero-cannes.jpg", position: "8% 55%" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="bg-noir relative hidden overflow-hidden lg:block">
        {/* Slow crossfading slideshow with a gentle zoom (still first photo under reduced motion). */}
        {SLIDES.map((slide, i) => (
          <div key={slide.src} aria-hidden className="auth-slide absolute inset-0">
            <Image
              src={slide.src}
              alt=""
              fill
              priority={i === 0}
              sizes="50vw"
              className="auth-slide-img object-cover"
              style={{ objectPosition: slide.position }}
            />
          </div>
        ))}
        {/* Soft fades so the logo (top) and tagline (bottom) stay readable on the photo. */}
        <div
          aria-hidden
          className="from-noir/70 to-noir/75 absolute inset-0 bg-gradient-to-b via-transparent via-45%"
        />
        <div className="text-cream absolute inset-0 flex flex-col justify-between p-12">
          <Logo className="auth-rise text-pink h-10 self-start" />
          <p
            className="auth-rise font-display max-w-sm text-3xl leading-snug italic"
            style={{ animationDelay: "350ms" }}
          >
            Made to remain.
          </p>
        </div>
      </div>
      <main id="main" className="bg-pink flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Logo className="text-burgundy mb-10 h-9 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
