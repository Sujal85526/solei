import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Newer / Older pagination for GET-filtered admin lists. `href(page)` builds the link. */
export function Pagination({
  page,
  pages,
  href,
  newer = "Newer",
  older = "Older",
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
  newer?: string;
  older?: string;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <Link
        aria-disabled={page <= 1}
        href={href(page - 1)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page <= 1 && "pointer-events-none opacity-50",
        )}
      >
        {newer}
      </Link>
      <span className="text-muted-foreground">
        Page {page} of {pages}
      </span>
      <Link
        aria-disabled={page >= pages}
        href={href(page + 1)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page >= pages && "pointer-events-none opacity-50",
        )}
      >
        {older}
      </Link>
    </nav>
  );
}

/** Query string from a filter object, dropping empty values. */
export function queryString(params: Record<string, string | number | undefined | null>) {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
