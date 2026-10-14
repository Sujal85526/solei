import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/admin/events/event-form";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay } from "@/lib/dates";
import { isDay } from "@/modules/events/calendar";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ searchParams }: PageProps<"/admin/calendar/new">) {
  await requirePagePermission("events.manage");
  const { date } = await searchParams;
  const defaultDate = isDay(date) ? date : businessDay();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link
        href="/admin/calendar"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Calendar
      </Link>
      <PageHeader
        title="New event"
        description="Exhibitions, pop-ups and private bookings. Each event gets its own stock location."
      />
      <AdminSection>
        <EventForm defaultDate={defaultDate} />
      </AdminSection>
    </div>
  );
}
