import type { Metadata } from "next";
import { loyaltyNav } from "@/components/admin/loyalty/nav";
import { RewardsSettingsForm, TiersForm } from "@/components/admin/loyalty/points-forms";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { SubNav } from "@/components/admin/sub-nav";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { getRewardsProgramme, pointsOverview } from "@/modules/points/queries";

export const metadata: Metadata = { title: "Points & tiers" };

export default async function PointsPage() {
  const staff = await requirePagePermission("loyalty.view");
  const canManage = can(staff.permissions, "loyalty.manage");
  const [{ settings, tiers }, overview] = await Promise.all([
    getRewardsProgramme(),
    pointsOverview(),
  ]);
  const members = new Map(overview.tiers.map((t) => [t.name, t.members]));

  return (
    <>
      <PageHeader
        title="Points & tiers"
        description="Points on every order, VIP tiers by yearly spend and a birthday bonus — beside the Solei Passport."
        actions={
          <Badge variant={settings.enabled ? "success" : "muted"}>
            {settings.enabled ? "On" : "Off — customers see nothing"}
          </Badge>
        }
      />
      <SubNav items={loyaltyNav(canManage)} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Members with points" value={overview.members} />
        <StatCard
          label="Points outstanding"
          value={overview.outstandingPoints.toLocaleString("en-GB")}
          hint={`${formatAED(overview.outstandingValueFils)} if all spent`}
        />
        <StatCard label="Earned · 30 days" value={overview.earned30d.toLocaleString("en-GB")} />
        <StatCard label="Spent · 30 days" value={overview.spent30d.toLocaleString("en-GB")} />
      </div>
      <div className="grid max-w-6xl gap-6">
        <AdminSection title="Programme">
          <RewardsSettingsForm settings={settings} canManage={canManage} />
        </AdminSection>
        <AdminSection
          title="VIP tiers"
          description={`By spend in the last 12 months. Members now: ${overview.tiers
            .map((t) => `${t.name} ${members.get(t.name) ?? 0}`)
            .join(" · ")}.`}
        >
          <TiersForm tiers={tiers} canManage={canManage} />
        </AdminSection>
      </div>
    </>
  );
}
