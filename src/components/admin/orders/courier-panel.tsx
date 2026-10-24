import Link from "next/link";
import { Printer } from "lucide-react";
import {
  BookCourierButton,
  RefreshTrackingButton,
} from "@/components/admin/orders/courier-buttons";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatBusinessDate } from "@/lib/dates";
import { canBook, SHIPMENT_STATUS_LABELS } from "@/modules/fulfilments/schema";
import { fulfilmentsForOrder } from "@/modules/fulfilments/service";
import type { ShipmentStatus, TrackingEvent } from "@/providers/courier/types";

const when = (iso: string) =>
  formatBusinessDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Courier on the order page: book it (marks the order dispatched with the tracking number), then
 * follow the courier's scans. Delivery orders only.
 */
export async function CourierPanel({
  order,
  canUpdate,
}: {
  order: { id: string; status: string; fulfilment: string };
  canUpdate: boolean;
}) {
  if (order.fulfilment !== "delivery") return null;
  const bookings = await fulfilmentsForOrder(order.id);
  const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "failed");
  if (!active.length && !(canUpdate && canBook(order))) return null;

  return (
    <AdminSection title="Courier">
      {bookings.length === 0 ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            Book the delivery with the courier: the order is marked dispatched and the customer gets
            the tracking number.
          </p>
          <BookCourierButton orderId={order.id} />
        </div>
      ) : (
        <ul className="flex flex-col gap-5 text-sm">
          {bookings.map((b) => {
            const events = (b.events as TrackingEvent[]) ?? [];
            return (
              <li key={b.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{b.courier}</span>{" "}
                    <span className="font-mono">{b.tracking_number}</span>
                  </span>
                  <Badge variant={b.status === "delivered" ? "success" : "outline"}>
                    {SHIPMENT_STATUS_LABELS[b.status as ShipmentStatus]}
                  </Badge>
                </div>
                <ol className="border-primary/20 flex flex-col gap-2 border-s ps-4">
                  {[...events].reverse().map((e, i) => (
                    <li key={i} className="flex flex-col">
                      <span>{e.description}</span>
                      <span className="text-muted-foreground text-xs">{when(e.at)}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {canUpdate && b.status !== "delivered" ? (
                    <RefreshTrackingButton orderId={order.id} fulfilmentId={b.id} />
                  ) : null}
                  <Link
                    href={b.label_url ?? `/admin/orders/${order.id}/label`}
                    target="_blank"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Printer /> Label
                  </Link>
                </div>
                {b.provider === "mock" ? (
                  <p className="text-muted-foreground text-xs">
                    Test courier — no real pickup until a courier account is connected.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AdminSection>
  );
}
