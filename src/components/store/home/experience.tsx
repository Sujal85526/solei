"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { optInAction } from "@/app/(store)/actions";
import { Parallax } from "@/components/motion/parallax";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";
import type { OptInState } from "@/modules/marketing/service";

/**
 * "More than a fragrance." — the Solei gift bag in late light (curtain unveil, parallax, slow light
 * sweep) + early-access email sign-up with explicit consent.
 */
export function Experience({ image }: { image: string }) {
  const [state, action, pending] = useActionState<OptInState, FormData>(optInAction, {
    status: "idle",
  });
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const errors = state.status === "error" ? state.fieldErrors : {};

  return (
    <section aria-labelledby="experience-title" className="grid lg:grid-cols-2">
      <div className="bg-noir light-sweep relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[40rem]">
        <Reveal data-curtain="" className="absolute inset-0">
          <Parallax from="-6%" to="6%" scale={1.12} className="absolute inset-0">
            <ShimmerImage
              src={image}
              alt="A burgundy Solei gift bag with a satin ribbon in late-afternoon light"
              fill
              tone="dark"
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-[35%_50%]"
            />
          </Parallax>
        </Reveal>
      </div>

      <div className="on-blush flex items-center px-6 py-20 sm:px-14 lg:px-20">
        <div className="w-full max-w-md">
          <p className="eyebrow text-burgundy/70">The experience</p>
          <h2 id="experience-title" className="display mt-5 text-5xl sm:text-6xl">
            More than <span className="block italic">a fragrance.</span>
          </h2>
          <span aria-hidden className="bg-burgundy/40 mt-8 block h-px w-12" />
          <p className="text-ink/80 mt-8 text-[0.95rem] leading-relaxed">
            A memory, a feeling, and a little piece of somewhere that stays with you. Be first to
            hear about new destinations, pop-ups and private previews.
          </p>
          {state.status === "success" ? (
            <p
              role="status"
              className="font-display text-burgundy mt-10 flex items-center gap-3 text-2xl italic"
            >
              <Check className="size-5" strokeWidth={1.5} /> You&apos;re on the list.
            </p>
          ) : (
            <form action={action} className="mt-10" noValidate>
              <input type="hidden" name="channel" value="email" />
              <label htmlFor="early-email" className="sr-only">
                Email
              </label>
              <div className="border-burgundy/40 focus-within:border-burgundy flex items-end gap-4 border-b">
                <input
                  id="early-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Sign up for early access"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  className="text-burgundy placeholder:text-burgundy/60 h-12 flex-1 bg-transparent text-[0.7rem] tracking-[0.22em] uppercase outline-none"
                />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label="Sign up"
                  className="border-burgundy/50 text-burgundy hover:bg-burgundy hover:text-pink mb-1.5 flex size-10 items-center justify-center rounded-full border transition-colors disabled:opacity-50"
                >
                  <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={1.25} />
                </button>
              </div>
              {errors.email ? <p className="mt-2 text-sm text-[#8c1630]">{errors.email}</p> : null}
              <label className="text-ink/70 mt-5 flex cursor-pointer items-start gap-3 text-xs leading-snug">
                <input
                  type="checkbox"
                  name="consent"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="accent-burgundy mt-0.5 size-4 shrink-0"
                />
                I agree to receive news and offers from Solei. Unsubscribe anytime.
              </label>
              {errors.consent ? (
                <p className="mt-2 text-sm text-[#8c1630]">{errors.consent}</p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
