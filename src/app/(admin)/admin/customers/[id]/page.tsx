import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ConsentBadge } from "@/components/admin/customers/badges";
import {
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/orders/order-badges";
import { PassportPanel } from "@/components/admin/customers/passport-panel";
import { SendWelcomeButton } from "@/components/admin/customers/welcome-email";
import {
  EditContactDialog,
  NotesForm,
  OptOutButton,
  QuickActions,
  RecordConsentDialog,
} from "@/components/admin/customers/profile-forms";
import { PageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSection, StatCard } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/phone";
import { customerOrders, getCustomer } from "@/modules/customers/queries";
import { welcomeSentAt } from "@/modules/customers/welcome";
import {
  averageOrderFils,
  channelLabel,
  consentState,
  emirateLabels,
  parseAddress,
  sourceLabels,
  type Emirate,
} from "@/modules/customers/schema";

export const metadata: Metadata = { title: "Customer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateTime = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const staff = await requirePagePermission("customers.view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const canManage = can(staff.permissions, "customers.manage");
  const canSeeOrders = can(staff.permissions, "orders.view");

  const [data, orders, welcomedAt] = await Promise.all([
    getCustomer(id),
    canSeeOrders ? customerOrders(id) : Promise.resolve([]),
    welcomeSentAt(id),
  ]);
  if (!data) notFound();
  const { customer: c, stats } = data;
  const address = parseAddress(c.address);
  const addressLines = [
    address.line1,
    address.line2,
    [address.area, address.city].filter(Boolean).join(", "),
  ].filter(Boolean);
  const title = c.name ?? c.email ?? (c.phone ? formatPhone(c.phone) : "Customer");
  const consent = consentState(c);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/customers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> Customers
      </Link>
      <PageHeader
        title={title}
        description={
          <>
            {sourceLabels[c.source]} · customer since {formatBusinessDate(c.created_at)}
          </>
        }
        actions={<QuickActions phone={c.phone} email={c.email} name={c.name} />}
      />

      {canSeeOrders ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Orders" value={stats.orderCount} />
          <StatCard
            label="Total spent"
            value={formatAED(stats.totalSpentFils)}
            hint="Paid, net of refunds"
          />
          <StatCard
            label="Average order"
            value={formatAED(averageOrderFils(stats.totalSpentFils, stats.orderCount))}
          />
          <StatCard
            label="Last purchase"
            value={stats.lastPurchaseAt ? formatBusinessDate(stats.lastPurchaseAt) : "—"}
            hint={
              stats.firstPurchaseAt
                ? `First ${formatBusinessDate(stats.firstPurchaseAt)}`
                : "No purchases yet"
            }
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {canSeeOrders ? (
            <AdminSection
              title="Orders"
              description="Every channel: website, event POS, WhatsApp, direct, payment links and bookings."
            >
              {orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">No orders yet.</p>
              ) : (
                <ul className="-mx-5 divide-y border-y sm:-mx-6" aria-label="Orders">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="hover:bg-muted/60 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[7.5rem_1fr_auto_1rem] sm:px-6"
                      >
                        <span className="flex flex-col">
                          <span className="font-mono text-sm font-medium">{o.number}</span>
                          <time dateTime={o.placedAt} className="text-muted-foreground text-xs">
                            {formatBusinessDate(o.placedAt)}
                          </time>
                        </span>
                        <span className="order-3 col-span-2 flex flex-wrap items-center gap-1.5 sm:order-none sm:col-span-1">
                          <ChannelBadge channel={o.channel} />
                          <OrderStatusBadge status={o.status} />
                          <PaymentStatusBadge status={o.paymentStatus} />
                          {o.eventName ? (
                            <span className="text-muted-foreground truncate text-xs">
                              {o.eventName}
                            </span>
                          ) : null}
                        </span>
                        <span className="numeric text-end">
                          <span className="block font-medium">{formatAED(o.totalFils)}</span>
                          {o.paymentStatus === "partially_paid" ? (
                            <span className="text-muted-foreground block text-xs">
                              {formatAED(o.outstandingFils)} due
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight className="text-muted-foreground hidden size-4 sm:block rtl:rotate-180" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminSection>
          ) : null}

          <AdminSection title="Notes">
            {canManage ? (
              <NotesForm id={c.id} notes={c.notes} />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{c.notes || "No notes."}</p>
            )}
          </AdminSection>
        </div>

        <div className="flex flex-col gap-6">
          <AdminSection
            title="Contact"
            actions={
              canManage ? (
                <EditContactDialog
                  customer={{
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    emirate: c.emirate,
                    address,
                  }}
                />
              ) : null
            }
          >
            <dl className="grid gap-3 text-sm">
              <Row label="Phone">{c.phone ? formatPhone(c.phone) : "—"}</Row>
              <Row label="Email">
                {c.email ? <span className="break-all">{c.email}</span> : "—"}
              </Row>
              <Row label="Emirate">{c.emirate ? emirateLabels[c.emirate as Emirate] : "—"}</Row>
              <Row label="Address">
                {addressLines.length ? (
                  <span className="whitespace-pre-line">{addressLines.join("\n")}</span>
                ) : (
                  "—"
                )}
              </Row>
              <Row label="Source">{sourceLabels[c.source]}</Row>
            </dl>
          </AdminSection>

          <AdminSection
            title="Welcome email"
            description="Welcomes a customer you added by hand to the website, with their sticker count."
          >
            <div className="flex flex-col items-start gap-3 text-sm">
              <p className="text-muted-foreground">
                {welcomedAt
                  ? `Sent on ${formatBusinessDate(welcomedAt, dateTime)}.`
                  : "Not sent yet."}
              </p>
              {!canManage ? null : c.email ? (
                <SendWelcomeButton
                  id={c.id}
                  name={c.name}
                  email={c.email}
                  alreadySent={Boolean(welcomedAt)}
                />
              ) : (
                <p>Add an email to this customer first — the welcome goes by email.</p>
              )}
            </div>
          </AdminSection>

          <AdminSection title="Marketing">
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <ConsentBadge customer={c} />
              </div>
              {consent === "opted_in" ? (
                <p>
                  Agreed to{" "}
                  {c.marketing_channels.length
                    ? c.marketing_channels.map(channelLabel).join(" and ")
                    : "marketing"}
                  {c.marketing_consent_at
                    ? ` on ${formatBusinessDate(c.marketing_consent_at, dateTime)}`
                    : ""}
                  .
                </p>
              ) : consent === "unsubscribed" && c.unsubscribed_at ? (
                <p>Opted out on {formatBusinessDate(c.unsubscribed_at, dateTime)}.</p>
              ) : (
                <p className="text-muted-foreground">
                  No marketing consent — send order updates only.
                </p>
              )}
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  <RecordConsentDialog
                    id={c.id}
                    hasPhone={Boolean(c.phone)}
                    hasEmail={Boolean(c.email)}
                    current={c.marketing_channels}
                  />
                  {consent !== "unsubscribed" ? <OptOutButton id={c.id} /> : null}
                </div>
              ) : null}
            </div>
          </AdminSection>

          {/* Streams in on its own so the customer details don't wait for the passport. */}
          <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
            <PassportPanel customerId={c.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
