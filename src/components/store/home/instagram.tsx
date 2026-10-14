import Image from "next/image";
import { InstagramIcon } from "@/components/brand";
import { Container, Eyebrow } from "@/components/brand";

const tiles = [
  { src: "/images/products/perfumes-trio.jpg", alt: "Cannes, Marbella and Verona perfumes" },
  { src: "/images/events/booth-table.jpg", alt: "A Solei pop-up table with passports" },
  { src: "/images/products/sprays-trio.jpg", alt: "Three all-over sprays" },
  { src: "/images/destinations/santorini.jpg", alt: "Santorini" },
  { src: "/images/products/perfumes-florals.jpg", alt: "Perfumes among burgundy florals" },
  { src: "/images/destinations/monaco.jpg", alt: "Monaco harbour" },
];

export function InstagramStrip({ handle, url }: { handle: string; url: string }) {
  return (
    <section aria-labelledby="ig-title" className="bg-cream pb-20 sm:pb-28">
      <Container size="wide">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Eyebrow lines>Follow the journey</Eyebrow>
          <h2 id="ig-title" className="text-3xl sm:text-4xl">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-3 hover:opacity-80"
            >
              <InstagramIcon className="size-7" />
              {handle}
            </a>
          </h2>
        </div>
        <ul className="grid grid-cols-3 gap-1.5 sm:gap-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <li key={tile.src}>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${tile.alt} — view on Instagram`}
                className="group bg-sand relative block aspect-square overflow-hidden"
              >
                <Image
                  src={tile.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 16vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-90"
                />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
