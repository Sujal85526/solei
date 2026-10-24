"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { formatBusinessDate } from "@/lib/dates";
import { clockInAction, clockOutAction } from "@/modules/attendance/actions";
import { hoursText, shiftMinutes, type Shift } from "@/modules/attendance/schema";

/** Clock in / out from the dashboard; optionally at one of today's events. */
export function ClockCard({
  open,
  events,
}: {
  open: Shift | null;
  events: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [eventId, setEventId] = useState(events.length === 1 ? events[0].id : "");
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done.");
      else toast.error(r.error ?? "Something went wrong.");
    });

  return (
    <div className="bg-card flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Clock className="text-primary size-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {open ? (
          <>
            <p className="font-medium">
              Clocked in since{" "}
              {formatBusinessDate(open.clockIn, { hour: "2-digit", minute: "2-digit" })}
              {open.eventName ? ` · ${open.eventName}` : ""}
            </p>
            <p className="text-muted-foreground text-xs">
              {hoursText(shiftMinutes(open, now))} so far
            </p>
          </>
        ) : (
          <>
            <p className="font-medium">Not clocked in</p>
            <Link
              href="/admin/attendance"
              className="text-muted-foreground text-xs underline-offset-4 hover:underline"
            >
              Your hours
            </Link>
          </>
        )}
      </div>
      {open ? (
        <Button variant="outline" disabled={pending} onClick={() => run(() => clockOutAction())}>
          Clock out
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {events.length ? (
            <NativeSelect
              aria-label="Event"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="[&_select]:h-9"
            >
              <option value="">No event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          <Button disabled={pending} onClick={() => run(() => clockInAction(eventId || null))}>
            Clock in
          </Button>
        </div>
      )}
    </div>
  );
}
