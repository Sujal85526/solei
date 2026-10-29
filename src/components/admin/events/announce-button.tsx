"use client";

import { Megaphone } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { announceEventAction } from "@/modules/automation/actions";

/** Start an email announcement of this event to the customers who asked for event news. */
export function AnnounceEventButton({ eventId }: { eventId: string }) {
  return (
    <ConfirmButton
      title="Announce this event?"
      description="Creates an email to every customer who asked for event news, filled in with the event's name, dates and place. You can change it and send yourself a test before it goes out."
      confirmLabel="Write the email"
      action={() => announceEventAction(eventId)}
    >
      <Megaphone /> Announce
    </ConfirmButton>
  );
}
