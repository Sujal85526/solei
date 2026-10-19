import Link from "next/link";
import { Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

/**
 * Bookings ("Plan your event") is built but not launched: until FEATURES.bookings is on, every
 * bookings page shows "Coming soon" (the website shows the same on /events).
 */
export default function BookingsLayout({ children }: LayoutProps<"/admin/bookings">) {
  if (FEATURES.bookings) return children;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="bg-pink text-burgundy flex size-14 items-center justify-center rounded-full">
        <Inbox className="size-6" strokeWidth={1.6} />
      </span>
      <h1 className="text-3xl">Bookings — coming soon</h1>
      <p className="text-muted-foreground text-sm">
        Event booking requests, quotes and deposits will appear here once &ldquo;Plan your
        event&rdquo; opens on the website.
      </p>
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to dashboard
      </Link>
    </div>
  );
}
