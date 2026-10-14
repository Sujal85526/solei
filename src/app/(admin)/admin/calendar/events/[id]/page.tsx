import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { formatEventDates } from "@/components/admin/events/event-card";
import { EventDocuments } from "@/components/admin/events/event-documents";
import { EventExpenses } from "@/components/admin/events/event-expenses";
import { EventStaff } from "@/components/admin/events/event-staff";
import { EventStock } from "@/components/admin/events/event-stock";
import { StatusBadge, TypeLabel } from "@/components/admin/events/event-style";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { businessDay, eachBusinessDay, formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone, waNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  allocationOptions,
  eventStock,
  findOverlaps,
  getEvent,
  listDocuments,
  listEventStaff,
  listExpenses,
  staffOptions,
  warehouseOptions,
} from "@/modules/events/queries";
import {
  emirateLabels,
  feePaymentStatusLabels,
  summariseHours,
  type Emirate,
} from "@/modules/events/schema";

export const metadata: Metadata = { title: "Event" };

const TABS = ["overview", "staff", "expenses", "documents", "stock"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  staff: "Staff",
  expenses: "Expenses",
  documents: "Documents",
  stock: "Stock",
};

export default async function EventPage({
  params,
  searchParams,
}: PageProps<"/admin/calendar/events/[id]">) {
  const staff = await requirePagePermission("events.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const event = await getEvent(id);
  if (!event) notFound();

  const perms = {
    manage: can(staff.permissions, "events.manage"),
    financial: can(staff.permissions, "reports.financial.view"),
    transfer: can(staff.permissions, "inventory.transfer"),
    stock: can(staff.permissions, "inventory.view"),
  };
  const tabs = TABS.filter((t) =>
    t === "expenses" ? perms.financial : t === "stock" ? perms.stock : true,
  );
  const tab: Tab = tabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const tabHref = (t: Tab) =>
    `/admin/calendar/events/${event.id}${t === "overview" ? "" : `?tab=${t}`}`;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link
        href={`/admin/calendar?date=${event.start_date}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Calendar
      </Link>
      <PageHeader
        title={event.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StatusBadge status={event.status} />
            <TypeLabel type={event.type} className="text-sm" />
            <span>
              {formatEventDates(event.start_date, event.end_date)}
              {event.start_date.slice(0, 4) !== businessDay().slice(0, 4)
                ? ` ${event.start_date.slice(0, 4)}`
                : ""}
            </span>
          </span>
        }
        actions={
          perms.manage ? (
            <Link
              href={`/admin/calendar/events/${event.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil /> Edit
            </Link>
          ) : null
        }
      />

      <nav aria-label="Event sections" className="-mx-4 -mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b">
          {tabs.map((t) => (
            <li key={t}>
              <Link
                href={tabHref(t)}
                scroll={false}
                aria-current={t === tab ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-4 text-sm transition-colors",
                  t === tab
                    ? "border-burgundy text-burgundy font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {TAB_LABELS[t]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" ? <Overview event={event} financial={perms.financial} /> : null}
      {tab === "staff" ? <StaffTab eventId={event.id} canManage={perms.manage} /> : null}
      {tab === "expenses" && perms.financial ? (
        <ExpensesTab
          eventId={event.id}
          defaultDate={event.start_date}
          canManage={perms.manage}
          feeFils={event.participation_fee_fils}
        />
      ) : null}
      {tab === "documents" ? <DocumentsTab eventId={event.id} canManage={perms.manage} /> : null}
      {tab === "stock" && perms.stock ? (
        <StockTab
          eventId={event.id}
          closedAt={event.closed_at}
          cancelled={event.status === "cancelled"}
          can={{
            allocate: perms.manage && perms.transfer,
            close: perms.manage && perms.transfer,
            reopen: perms.manage,
          }}
        />
      ) : null}
    </div>
  );
}

async function Overview({
  event,
  financial,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getEvent>>>;
  financial: boolean;
}) {
  const overlaps =
    event.status === "cancelled"
      ? []
      : await findOverlaps({
          startDate: event.start_date,
          endDate: event.end_date,
          excludeId: event.id,
          location: event.location ?? undefined,
        });
  const days = eachBusinessDay(event.start_date, event.end_date);
  const hoursSummary = summariseHours(event.daily_hours, event.start_date, event.end_date);
  const place = [event.location, event.emirate ? emirateLabels[event.emirate as Emirate] : null]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        {overlaps.length ? (
          <div
            role="status"
            data-testid="overlap-warning"
            className="flex gap-3 rounded-xl border border-[#B4690E]/40 bg-[#B4690E]/5 p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#8A5108]" aria-hidden />
            <div>
              <p className="font-medium text-[#8A5108]">Overlaps with</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {overlaps.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/calendar/events/${o.id}`}
                      className="text-burgundy underline-offset-4 hover:underline"
                    >
                      {o.name}
                    </Link>{" "}
                    <span className="text-muted-foreground text-xs">
                      {formatEventDates(o.start_date, o.end_date)}
                      {o.same_location ? " · same venue" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <AdminSection title="When & where">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Dates</dt>
              <dd className="mt-0.5 font-medium">
                {formatBusinessDate(event.start_date, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {days.length > 1
                  ? ` – ${formatBusinessDate(event.end_date, { weekday: "short", day: "numeric", month: "short" })}`
                  : ""}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  · {days.length} day{days.length > 1 ? "s" : ""}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Location</dt>
              <dd className="mt-0.5 flex items-start gap-1 font-medium">
                {place ? (
                  <>
                    <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(place)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {place}
                    </a>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">
                Working hours{hoursSummary ? ` · ${hoursSummary}` : ""}
              </dt>
              <dd className="mt-1">
                {Object.keys(event.daily_hours).length ? (
                  <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {days.map((d) => (
                      <li
                        key={d}
                        className="flex justify-between gap-4 border-b border-dashed py-1"
                      >
                        <span>
                          {formatBusinessDate(d, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="numeric font-medium">
                          {event.daily_hours[d]
                            ? `${event.daily_hours[d].open}–${event.daily_hours[d].close}`
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Booth</dt>
              <dd className="mt-0.5 whitespace-pre-line">{event.booth_details || "—"}</dd>
            </div>
          </dl>
        </AdminSection>

        {event.notes ? (
          <AdminSection title="Notes">
            <p className="text-sm whitespace-pre-line">{event.notes}</p>
          </AdminSection>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <AdminSection title="Organiser">
          {event.organiser_name ||
          event.organiser_contact ||
          event.organiser_phone ||
          event.organiser_email ? (
            <div className="flex flex-col gap-2 text-sm">
              {event.organiser_name ? <p className="font-medium">{event.organiser_name}</p> : null}
              {event.organiser_contact ? (
                <p className="text-muted-foreground">{event.organiser_contact}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-2">
                {event.organiser_phone ? (
                  <>
                    <a
                      href={`tel:${event.organiser_phone}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <Phone /> {formatPhone(event.organiser_phone)}
                    </a>
                    <a
                      href={`https://wa.me/${waNumber(event.organiser_phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <MessageCircle /> WhatsApp
                    </a>
                  </>
                ) : null}
                {event.organiser_email ? (
                  <a
                    href={`mailto:${event.organiser_email}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Mail /> Email
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No organiser details.</p>
          )}
        </AdminSection>

        <AdminSection title="Participation">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {financial ? (
              <div>
                <dt className="text-muted-foreground text-xs">Fee</dt>
                <dd className="numeric mt-0.5 font-medium">
                  {formatAED(event.participation_fee_fils)}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground text-xs">Payment</dt>
              <dd className="mt-0.5 font-medium">
                {feePaymentStatusLabels[event.fee_payment_status]}
              </dd>
            </div>
          </dl>
        </AdminSection>
      </div>
    </div>
  );
}

async function StaffTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const [assigned, people] = await Promise.all([
    listEventStaff(eventId),
    canManage ? staffOptions() : [],
  ]);
  return (
    <AdminSection title="Staff" description="Who works this event.">
      <EventStaff eventId={eventId} assigned={assigned} people={people} canManage={canManage} />
    </AdminSection>
  );
}

async function ExpensesTab({
  eventId,
  defaultDate,
  canManage,
  feeFils,
}: {
  eventId: string;
  defaultDate: string;
  canManage: boolean;
  feeFils: number;
}) {
  const expenses = await listExpenses(eventId);
  return (
    <AdminSection
      title="Expenses"
      description="Visible only to people who can see costs and profit."
    >
      <EventExpenses
        eventId={eventId}
        expenses={expenses}
        defaultDate={defaultDate}
        canManage={canManage}
        participationFeeFils={feeFils}
      />
    </AdminSection>
  );
}

async function DocumentsTab({ eventId, canManage }: { eventId: string; canManage: boolean }) {
  const documents = await listDocuments(eventId);
  return (
    <AdminSection title="Documents">
      <EventDocuments eventId={eventId} documents={documents} canManage={canManage} />
    </AdminSection>
  );
}

async function StockTab({
  eventId,
  closedAt,
  cancelled,
  can: canDo,
}: {
  eventId: string;
  closedAt: string | null;
  cancelled: boolean;
  can: { allocate: boolean; close: boolean; reopen: boolean };
}) {
  const [{ rows }, alloc, warehouses] = await Promise.all([
    eventStock(eventId),
    canDo.allocate ? allocationOptions() : { main: null, options: [] },
    canDo.close ? warehouseOptions() : [],
  ]);
  return (
    <AdminSection
      title="Stock"
      description="Allocated → sold → returned. Sales at the event POS come off this event's stock."
    >
      <EventStock
        eventId={eventId}
        rows={rows}
        options={alloc.options}
        mainName={alloc.main?.name ?? "main stock"}
        warehouses={warehouses}
        closedAt={closedAt}
        cancelled={cancelled}
        can={canDo}
      />
    </AdminSection>
  );
}
