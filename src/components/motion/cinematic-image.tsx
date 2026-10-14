import { Parallax } from "./parallax";
import { Reveal } from "./reveal";
import { ShimmerImage } from "./shimmer-image";

/**
 * A full-bleed photo that unveils like a curtain when it scrolls in, then drifts with the scroll.
 * Fills its positioned parent.
 */
export function CinematicImage({
  src,
  alt,
  sizes,
  drift = "6%",
  position,
  delay,
}: {
  src: string;
  alt: string;
  sizes: string;
  /** Parallax travel either side of centre. */
  drift?: string;
  position?: string;
  delay?: number;
}) {
  return (
    <Reveal data-curtain="" delay={delay} className="absolute inset-0">
      <Parallax from={`-${drift}`} to={drift} scale={1.14} className="absolute inset-0">
        <ShimmerImage
          src={src}
          alt={alt}
          fill
          tone="dark"
          sizes={sizes}
          className="object-cover"
          style={position ? { objectPosition: position } : undefined}
        />
      </Parallax>
    </Reveal>
  );
}
