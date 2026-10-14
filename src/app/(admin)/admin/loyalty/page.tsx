import type { Metadata } from "next";
import Link from "next/link";
import { LedgerList } from "@/components/admin/loyalty/ledger";
import { loyaltyNav } from "@/components/admin/loyalty/nav";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { SubNav } from "@/components/admin/sub-nav";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { describeRule } from "@/modules/loyalty/format";
import { getOverview, getProgrammeAdmin, recentActivity } from "@/modules/loyalty/queries";

export const metadata: Metadata = { title: "Loyalty" };

export default async function LoyaltyPage() {
  const staff = await requirePagePermission("loyalty.view");
  const [overview, programme, activity] = await Promise.all([
    getOverview(),
    getProgrammeAdmin(),
    recentActivity(25),
  ]);
  const names = new Map(
    [...programme.categories, ...programme.products].map((x) => [x.id, x.name]),
  );
  const rule = programme.active;

  return (
    <>
      <PageHeader
        title="Solei Passport"
        description="Stamps across every channel — website, event POS, WhatsApp and direct sales."
      />
      <SubNav items={loyaltyNav(can(staff.permissions, "loyalty.manage"))} />
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Members" value={overview.members} hint="Customers with stamps" />
          <StatCard label="Passports issued" value={overview.passports_issued} />
          <StatCard
            label="Stamps collected"
            value={overview.stamps_collected}
            hint={`${overview.stamps_30d} earned in the last 30 days`}
          />
          <StatCard
            label="Rewards"
            value={overview.rewards_available}
            hint={`available · ${overview.rewards_redeemed} redeemed`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <AdminSection title="Latest stamps" description="Newest first, all customers.">
            <LedgerList entries={activity} showCustomer />
          </AdminSection>
          <AdminSection
            title="Rules in force"
            actions={
              <Badge variant={programme.enabled ? "success" : "muted"}>
                {programme.enabled ? "On" : "Off"}
              </Badge>
            }
          >
            {rule ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Version {rule.version} · since {formatBusinessDate(rule.effectiveFrom)}
                </p>
                <ul className="flex list-disc flex-col gap-1 ps-5">
                  {describeRule(rule, (id) => names.get(id)).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {can(staff.permissions, "loyalty.manage") ? (
                  <Link
                    href="/admin/loyalty/settings"
                    className="text-burgundy min-h-11 font-medium underline-offset-4 hover:underline"
                  >
                    Change the rules
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No rules set up yet.</p>
            )}
          </AdminSection>
        </div>
      </div>
    </>
  );
}
