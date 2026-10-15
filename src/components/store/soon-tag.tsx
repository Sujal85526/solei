import { t } from "@/content/en";
import { cn } from "@/lib/utils";

/** Small "Soon" label beside a locked (not yet launched) page in the navigation. */
export function SoonTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-pink/30 text-pink/80 ms-1.5 inline-block rounded-full border px-1.5 py-px align-middle text-[0.5rem] tracking-[0.2em] uppercase",
        className,
      )}
    >
      {t.nav.soon}
    </span>
  );
}
