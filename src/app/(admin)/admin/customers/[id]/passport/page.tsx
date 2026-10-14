import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LedgerList, RewardStatusBadge } from "@/components/admin/loyalty/ledger";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { progress } from "@/modules/loyalty/engine";
import { getCustomerLoyalty, getPublicProgramme } from "@/modules/loyalty/queries";
import { passportHowLabels } from "@/modules/loyalty/schema";
import { getCustomer } from "@/modules/customers/queries";

export const metadata: Metadata = { title: "Passport ledger" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerPassportPage({
  params,
}: PageProps<"/admin/customers/[id]/passport">) {
  await requirePagePermission("loyalty.view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [data, card, programme] = await Promise.all([
    getCustomer(id),
    getCustomerLoyalty(id, { staff: true }),
    getPublicProgramme(),
  ]);
  if (!data) notFound();
  const c = data.customer;
  const name = c.name ?? c.email ?? (c.phone ? formatPhone(c.phone) : "Customer");
  const p = progress(card.balance, programme.rule?.stampsForReward ?? 12);
  const earned = card.ledger.filter((e) => e.kind === "earned").length;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/customers/${id}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" /> {name}
      </Link>
      <PageHeader
        title="Passport ledger"
        description={
          card.passport
            ? `${card.passport.number} · issued ${passportHowLabels[card.passport.how].toLowerCase()} on ${formatBusinessDate(card.passport.issuedAt)}`
            : "No passport issued yet"
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current card" value={`${p.collected} / ${p.total}`} />
        <StatCard label="Collected" value={card.collected} hint="Net, all time" />
        <StatCard label="Purchases stamped" value={earned} />
        <StatCard
          label="Rewards"
          value={card.rewards.filter((r) => r.status === "available").length}
          hint={`${card.rewards.filter((r) => r.status === "redeemed").length} redeemed`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <AdminSection title="Stamps" description="Newest first. Every change is also in the activity log.">
          <LedgerList entries={card.ledger} />
        </AdminSection>
        <AdminSection title="Rewards">
          {card.rewards.length ? (
            <ul className="flex flex-col gap-3">
              {card.rewards.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.label}</span>
                    <RewardStatusBadge status={r.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {r.stampsCost} stamps · unlocked {formatBusinessDate(r.createdAt)}
                    {r.sourceOrder ? ` by ${r.sourceOrder.number}` : ""}
                  </p>
                  {r.redeemedOrder ? (
                    <p className="text-xs">
                      Redeemed on{" "}
                      <Link href={`/admin/orders/${r.redeemedOrder.id}`} className="font-mono underline">
                        {r.redeemedOrder.number}
                      </Link>
                      {r.redeemedAt ? ` · ${formatBusinessDate(r.redeemedAt)}` : ""}
                    </p>
                  ) : null}
                  {r.note ? <p className="text-muted-foreground text-xs">{r.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No rewards yet.</p>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
