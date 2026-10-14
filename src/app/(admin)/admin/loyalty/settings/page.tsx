import type { Metadata } from "next";
import { loyaltyNav } from "@/components/admin/loyalty/nav";
import { LoyaltySettingsForm } from "@/components/admin/loyalty/settings-form";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { SubNav } from "@/components/admin/sub-nav";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { describeRule } from "@/modules/loyalty/format";
import { getProgrammeAdmin } from "@/modules/loyalty/queries";
import { rewardTypeLabels, rewardValueText } from "@/modules/loyalty/schema";

export const metadata: Metadata = { title: "Loyalty settings" };

const dateTime = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

export default async function LoyaltySettingsPage() {
  await requirePagePermission("loyalty.manage");
  const programme = await getProgrammeAdmin();
  const names = new Map(
    [...programme.categories, ...programme.products].map((x) => [x.id, x.name]),
  );
  const rule = programme.active;

  return (
    <>
      <PageHeader
        title="Solei Passport"
        description="Every loyalty rule is yours to change. Each save becomes a new rule version."
      />
      <SubNav items={loyaltyNav(true)} />
      <div className="grid max-w-6xl gap-6 lg:grid-cols-[1fr_22rem]">
        <AdminSection title="Programme settings">
          {rule ? (
            <LoyaltySettingsForm
              values={{
                enabled: programme.enabled,
                stampsPerItem: rule.stampsPerItem,
                qualifyingCategoryIds: [...rule.qualifyingCategoryIds],
                qualifyingProductIds: [...rule.qualifyingProductIds],
                stampsForReward: rule.stampsForReward,
                rewardType: rule.rewardType,
                rewardConfig: rule.rewardConfig,
                rewardLabel: rule.rewardLabel,
                issuePassportAfterPurchases: rule.issuePassportAfterPurchases,
                rewardItemsEarnStamps: rule.rewardItemsEarnStamps,
                expiryMonths: rule.expiryMonths,
              }}
              categories={programme.categories}
              products={programme.products.map((p) => ({
                id: p.id,
                name: p.active ? p.name : `${p.name} (inactive)`,
              }))}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No rule version found — run the loyalty migration.
            </p>
          )}
        </AdminSection>

        <AdminSection
          title="Rule history"
          description="Newest first. Stamps keep the version they were earned under."
        >
          <ol className="flex flex-col gap-4" aria-label="Rule versions">
            {programme.versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-1.5 border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Version {v.version}</span>
                  {v.id === rule?.id ? <Badge variant="success">In force</Badge> : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  From {formatBusinessDate(v.effectiveFrom, dateTime)}
                  {v.createdByName ? ` · ${v.createdByName}` : ""}
                </p>
                <ul className="flex list-disc flex-col gap-0.5 ps-5 text-xs">
                  {describeRule(v, (id) => names.get(id)).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                  <li>
                    {rewardTypeLabels[v.rewardType]}
                    {v.rewardType === "choose_from_category" && v.rewardConfig.category_id
                      ? `: ${names.get(String(v.rewardConfig.category_id)) ?? "removed category"}`
                      : (rewardValueText(v.rewardType, v.rewardConfig) ?? "")
                        ? `: ${rewardValueText(v.rewardType, v.rewardConfig)}`
                        : ""}
                  </li>
                </ul>
                {v.note ? <p className="text-xs italic">{v.note}</p> : null}
              </li>
            ))}
          </ol>
        </AdminSection>
      </div>
    </>
  );
}
