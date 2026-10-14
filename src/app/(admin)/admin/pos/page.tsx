import type { Metadata } from "next";
import Link from "next/link";
import { PosScreen } from "@/components/admin/pos/pos-screen";
import { PosServiceWorker } from "@/components/admin/pos/pos-sw";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { daySummary, posEvents, posProducts } from "@/modules/pos/queries";

export const metadata: Metadata = { title: "POS" };

export default async function PosPage({ searchParams }: PageProps<"/admin/pos">) {
  await requirePagePermission("pos.use");
  const sp = await searchParams;
  const events = await posEvents();
  const requested = typeof sp.event === "string" ? sp.event : undefined;
  const event = events.find((e) => e.id === requested) ?? events[0];
  if (!event) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-3xl">No events to sell at</h1>
        <p className="text-muted-foreground text-sm">
          Create or confirm an event in the calendar, then allocate stock to it.
        </p>
        <Link href="/admin/calendar/new" className={buttonVariants()}>
          New event
        </Link>
      </div>
    );
  }
  const [products, summary] = await Promise.all([posProducts(event.id), daySummary(event.id)]);
  return (
    <>
      <h1 className="sr-only">Point of sale</h1>
      <PosScreen
        key={event.id}
        events={events}
        eventId={event.id}
        products={products}
        summary={summary}
      />
      <PosServiceWorker />
    </>
  );
}
