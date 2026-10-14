import { Stagger } from "@/components/motion/reveal";
import { Reveal } from "@/components/motion/reveal";
import { ShimmerImage } from "@/components/motion/shimmer-image";

const PHOTOS = [
  {
    src: "/images/events/booth-table.jpg",
    alt: "Solei perfumes, destination cards and passports on a floral pop-up table",
    tilt: "-rotate-3",
    aspect: "aspect-[1/1]",
  },
  {
    src: "/images/products/sprays-stone.jpg",
    alt: "Three Solei all-over sprays on warm stone",
    tilt: "rotate-2",
    aspect: "aspect-[3/4]",
  },
  {
    src: "/images/products/perfumes-trio.jpg",
    alt: "Cannes, Marbella and Verona perfumes in front of their destination cards",
    tilt: "-rotate-1",
    aspect: "aspect-[4/3]",
  },
  {
    src: "/images/events/booth-passport.jpg",
    alt: "Solei passports and perfumes beneath pink and burgundy flowers",
    tilt: "rotate-3",
    aspect: "aspect-[5/4]",
  },
];

/**
 * "Seen at our pop-ups." — real brand photography as tilted prints that straighten on hover,
 * revealed one by one. Links to Instagram.
 */
export function PopupGallery() {
  return (
    <section aria-labelledby="popups-title" className="bg-noir overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-[96rem] px-6 sm:px-10 lg:px-14">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow text-pink/70">Made to remain</p>
          <h2 id="popups-title" className="display mt-5 text-5xl sm:text-6xl">
            Seen at our <span className="italic">pop-ups.</span>
          </h2>
          <p className="text-pearl/75 mt-6 text-[0.95rem] leading-relaxed">
            Florals, destination cards and the Solei Passport — a booth people stop for, and
            remember.
          </p>
        </Reveal>
        <Stagger
          as="ul"
          step={140}
          className="mt-14 grid grid-cols-2 items-center gap-5 sm:gap-8 lg:grid-cols-4"
        >
          {PHOTOS.map((p) => (
            <li key={p.src}>
              <figure
                className={`bg-pearl group p-2 pb-8 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] transition-transform duration-700 ease-(--ease-soft) hover:-translate-y-2 hover:rotate-0 sm:p-3 sm:pb-10 ${p.tilt}`}
              >
                <div className={`relative overflow-hidden ${p.aspect}`}>
                  <ShimmerImage
                    src={p.src}
                    alt={p.alt}
                    fill
                    sizes="(min-width: 1024px) 22vw, 45vw"
                    className="object-cover transition-transform duration-[1400ms] ease-(--ease-soft) group-hover:scale-105"
                  />
                </div>
              </figure>
            </li>
          ))}
        </Stagger>
        <Reveal className="mt-14 text-center">
          <a
            href="https://instagram.com/solei.ad"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pearl/85 hover:text-pink border-pink/30 hover:border-pink border-b pb-1 text-[0.65rem] tracking-[0.3em] uppercase"
          >
            Follow @solei.ad
          </a>
        </Reveal>
      </div>
    </section>
  );
}
