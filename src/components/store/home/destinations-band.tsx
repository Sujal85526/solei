import { Reveal } from "@/components/motion/reveal";
import { CircleArrowLink } from "./circle-arrow-link";
import { SectionCopy } from "./section-copy";

/**
 * "Different places. Same feeling." — a see-through band: the fixed hero photographs show through
 * behind a frosted card, so the page opens a window back onto them.
 */
export function DestinationsBand() {
  return (
    <section
      aria-labelledby="destinations-title"
      className="flex min-h-[85svh] items-center px-6 py-24 sm:px-10 lg:px-14"
    >
      <Reveal className="relative z-10 w-full sm:w-auto">
        <div className="border-pearl/15 bg-noir/40 relative z-10 rounded-sm border p-8 backdrop-blur-2xl sm:p-14">
          <SectionCopy
            id="destinations-title"
            eyebrow="The destinations"
            title={["Different places.", "Same feeling."]}
            action={<CircleArrowLink href="/destinations">Explore</CircleArrowLink>}
          >
            Eight destinations, each with its own light, mood and memory. Find the one that feels
            like yours.
          </SectionCopy>
        </div>
      </Reveal>
    </section>
  );
}
