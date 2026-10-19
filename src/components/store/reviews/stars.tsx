import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five stars, filled to the rating (halves round to the nearest whole star). Display only. */
export function Stars({
  rating,
  className,
  size = "size-3.5",
}: {
  rating: number;
  className?: string;
  size?: string;
}) {
  const full = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className={cn("text-primary inline-flex gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          strokeWidth={1.25}
          className={cn(size, i <= full ? "fill-current" : "fill-transparent opacity-40")}
        />
      ))}
    </span>
  );
}
