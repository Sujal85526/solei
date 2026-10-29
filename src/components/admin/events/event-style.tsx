import { CalendarHeart, Gem, type LucideIcon, Sparkles, Store, Tent } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  eventStatusLabels,
  eventTypeLabels,
  type EventStatus,
  type EventType,
} from "@/modules/events/schema";

/**
 * Status drives the colour: potential ("Upcoming") = dashed outline, confirmed = burgundy,
 * completed = muted sage, cancelled = struck-through grey. Type drives the icon.
 */
export const statusChip: Record<EventStatus, string> = {
  potential: "border border-dashed border-burgundy/70 bg-card text-burgundy",
  confirmed: "border border-burgundy bg-burgundy text-cream",
  completed: "border border-[#B9C7B4] bg-[#E6ECE2] text-[#3E5238]",
  cancelled: "border border-[#D6D1CE] bg-[#F1EFED] text-[#8A8380] line-through",
};

/** Small dot for compact phone month cells. */
export const statusDot: Record<EventStatus, string> = {
  potential: "border border-dashed border-burgundy bg-transparent",
  confirmed: "bg-burgundy",
  completed: "bg-[#7E9677]",
  cancelled: "bg-[#BDB6B2]",
};

export const typeIcon: Record<EventType, LucideIcon> = {
  exhibition: Tent,
  popup: Store,
  private_booking: CalendarHeart,
  wedding: Gem,
  other: Sparkles,
};

export function TypeIcon({ type, className }: { type: EventType; className?: string }) {
  const Icon = typeIcon[type];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} strokeWidth={1.75} />;
}

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium",
        statusChip[status],
        className,
      )}
    >
      {eventStatusLabels[status]}
    </span>
  );
}

export function TypeLabel({ type, className }: { type: EventType; className?: string }) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex items-center gap-1 text-xs",
        type === "private_booking" && "text-gold-ink font-medium",
        className,
      )}
    >
      <TypeIcon type={type} />
      {eventTypeLabels[type]}
    </span>
  );
}

/** Legend under the calendar. */
export function CalendarLegend() {
  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      {(Object.keys(eventStatusLabels) as EventStatus[]).map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span className={cn("inline-block size-3 rounded-sm", statusChip[s])} aria-hidden />
          {eventStatusLabels[s]}
        </li>
      ))}
      {(Object.keys(eventTypeLabels) as EventType[]).map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <TypeIcon type={t} />
          {eventTypeLabels[t]}
        </li>
      ))}
    </ul>
  );
}
