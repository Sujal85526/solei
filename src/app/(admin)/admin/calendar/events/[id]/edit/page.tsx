import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/admin/events/event-form";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { getEvent } from "@/modules/events/queries";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({
  params,
}: PageProps<"/admin/calendar/events/[id]/edit">) {
  await requirePagePermission("events.manage");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href={`/admin/calendar/events/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {event.name}
      </Link>
      <PageHeader title="Edit event" />
      <AdminSection>
        <EventForm event={event} defaultDate={event.start_date} />
      </AdminSection>
    </div>
  );
}
