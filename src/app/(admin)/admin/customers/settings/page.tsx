import type { Metadata } from "next";
import Link from "next/link";
import {
  AutomationSettingsForm,
  LabelRulesForm,
} from "@/components/admin/customers/automation-settings";
import { CustomersNav } from "@/components/admin/customers/customers-nav";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/auth/session";
import {
  automationStats,
  getAutomationSettings,
  getLabelRules,
} from "@/modules/automation/queries";
import {
  customerLabels,
  describeLabelRules,
  labelBadgeVariant,
  labelNames,
} from "@/modules/customers/labels";

export const metadata: Metadata = { title: "Labels & emails" };

export default async function CustomerSettingsPage() {
  await requirePagePermission("settings.manage");
  const [rules, settings, stats] = await Promise.all([
    getLabelRules(),
    getAutomationSettings(),
    automationStats(),
  ]);
  const described = describeLabelRules(rules);

  return (
    <>
      <PageHeader
        title="Labels & emails"
        description="How customers are labelled, and the emails that go out on their own."
      />
      <CustomersNav canSettings />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Feedback requests" value={stats.feedbackSent} hint="Last 30 days" />
        <StatCard label="Answered" value={stats.feedbackAnswered} hint="Last 30 days" />
        <StatCard
          label="Event news"
          value={stats.eventNewsSubscribers}
          hint="Customers who asked for it"
        />
      </div>
      <div className="grid max-w-4xl gap-6">
        <AdminSection
          title="Customer labels"
          description="Worked out from each customer's purchases — nobody types them. The first that fits wins, in this order:"
        >
          <ul className="mb-5 grid gap-2 text-sm">
            {customerLabels.map((l) => (
              <li key={l} className="flex items-center gap-3">
                <Badge variant={labelBadgeVariant[l]} className="w-20 justify-center">
                  {labelNames[l]}
                </Badge>
                {described[l]}
              </li>
            ))}
          </ul>
          <LabelRulesForm rules={rules} />
        </AdminSection>
        <AdminSection
          title="Automatic emails"
          description={
            <>
              Event announcements are sent from the event&apos;s page in the{" "}
              <Link href="/admin/calendar" className="underline underline-offset-4">
                calendar
              </Link>{" "}
              to customers who asked for event news.
            </>
          }
        >
          <AutomationSettingsForm settings={settings} />
        </AdminSection>
      </div>
    </>
  );
}
