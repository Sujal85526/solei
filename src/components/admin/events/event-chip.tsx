import Link from "next/link";
import { cn } from "@/lib/utils";
import { eventStatusLabels, eventTypeLabels } from "@/modules/events/schema";
import type { CalendarEvent } from "@/modules/events/queries";
import { TypeIcon, statusChip } from "./event-style";

export const eventHref = (id: string) => `/admin/calendar/events/${id}`;

/** Compact bar used in month/week grids. Private bookings get a gold edge so they stand out. */
export function EventChip({
  event,
  className,
  style,
  continuesBefore,
  continuesAfter,
}: {
  event: CalendarEvent;
  className?: string;
  style?: React.CSSProperties;
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}) {
  return (
    <Link
      href={eventHref(event.id)}
      style={style}
      title={`${event.name} · ${eventTypeLabels[event.type]} · ${eventStatusLabels[event.status]}`}
      aria-label={`${event.name}, ${eventTypeLabels[event.type]}, ${eventStatusLabels[event.status]}`}
      data-status={event.status}
      data-type={event.type}
      className={cn(
        "flex h-6 min-w-0 items-center gap-1 rounded px-1.5 text-[0.7rem] leading-none font-medium transition-opacity hover:opacity-85",
        statusChip[event.status],
        event.type === "private_booking" && "border-s-gold border-s-[3px]",
        continuesBefore && "rounded-s-none",
        continuesAfter && "rounded-e-none",
        className,
      )}
    >
      <TypeIcon type={event.type} className="size-3" />
      <span className="truncate">{event.name}</span>
    </Link>
  );
}
