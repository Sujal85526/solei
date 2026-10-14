"use client";

import Image from "next/image";
import { useState } from "react";
import { Check } from "lucide-react";
import { eventsCopy as c } from "@/content/events";
import { formatAED } from "@/lib/money";
import { draftStore } from "@/modules/bookings/draft-store";
import { WIZARD_STEPS } from "@/modules/bookings/schema";
import type { BookingConfig } from "@/modules/bookings/types";
import { PackageCompare } from "./package-compare";

const PACKAGE_STEP = WIZARD_STEPS.findIndex((s) => s.id === "package");

/** Package cards (photo, inclusions, price) with a compare view; "Plan with this" pre-fills the wizard. */
export function PackagesShowcase({ packages }: { packages: BookingConfig["packages"] }) {
  const [compare, setCompare] = useState(false);
  if (!packages.length) return null;

  function choose(id: string) {
    draftStore.update({ packageId: id });
    const { draft } = draftStore.get();
    // Jump straight to the package step when the earlier steps are already answered.
    if (draft.eventTypeId && draft.eventDate && draft.serviceTypeIds.length) {
      draftStore.setStep(PACKAGE_STEP);
    }
    document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      id="packages"
      aria-labelledby="packages-title"
      className="border-pink/10 scroll-mt-20 border-t py-20 sm:py-28"
    >
      <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-pink/70">{c.packages.eyebrow}</p>
            <h2 id="packages-title" className="display mt-5 text-5xl sm:text-6xl">
              {c.packages.title} <span className="italic">{c.packages.titleItalic}</span>
            </h2>
            <p className="text-pearl/80 mt-6 max-w-xl text-[0.95rem] leading-relaxed">
              {c.packages.lede}
            </p>
          </div>
          <button
            type="button"
            aria-expanded={compare}
            aria-controls="package-compare"
            onClick={() => setCompare((v) => !v)}
            className="border-pink/40 text-pink hover:border-pink inline-flex h-11 shrink-0 items-center self-start border px-6 text-[0.65rem] tracking-[0.3em] uppercase transition-colors sm:self-auto"
          >
            {compare ? c.packages.hideCompare : c.packages.compare}
          </button>
        </div>

        {compare ? (
          <div id="package-compare" className="mt-10">
            <PackageCompare packages={packages} />
          </div>
        ) : null}

        <ul className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id} className="border-pink/15 bg-wine/40 flex flex-col border">
              {p.images[0] ? (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={p.images[0]}
                    alt={`The ${p.name} package`}
                    fill
                    sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-5 p-6 sm:p-8">
                <div>
                  <h3 className="font-display text-pink text-3xl">{p.name}</h3>
                  {p.description ? (
                    <p className="text-pearl/75 mt-2 text-sm leading-relaxed">{p.description}</p>
                  ) : null}
                </div>
                <p className="numeric text-pearl">
                  <span className="eyebrow text-pearl-muted me-2">{c.packages.from}</span>
                  <span className="font-display text-2xl">{formatAED(p.basePriceFils)}</span>
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.inclusions.map((inc) => (
                    <li key={inc} className="text-pearl/85 flex gap-3">
                      <Check className="text-pink mt-0.5 size-4 shrink-0" aria-hidden />
                      {inc}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(p.id)}
                  className="bg-pink text-burgundy hover:bg-pearl mt-auto inline-flex h-12 items-center justify-center px-6 text-[0.65rem] tracking-[0.3em] uppercase transition-colors"
                >
                  {c.packages.choose}
                  <span className="sr-only">: {p.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
