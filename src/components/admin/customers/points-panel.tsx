import Link from "next/link";
import { PointsAdjustDialog, BirthdayEditor } from "@/components/admin/customers/points-forms";
import { AdminSection } from "@/components/admin/section";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { customerPoints } from "@/modules/points/queries";
import { MONTHS, multiplierText, POINTS_ENTRY_LABELS } from "@/modules/points/schema";

/** Points & tier on the customer profile (loyalty.view); adjust with loyalty.adjust. */
export async function PointsPanel({
  customerId,
  birthday,
}: {
  customerId: string;
  birthday: { month: number; day: number } | null;
}) {
  const staff = await requireStaff();
  if (!can(staff.permissions, "loyalty.view")) return null;
  const s = await customerPoints(customerId);
  return (
    <AdminSection
      title="Points & tier"
      actions={
        <>
          {s.tier ? (
            <Badge variant="outline">
              {s.tier.name} · {multiplierText(s.tier.multiplierBp)}
            </Badge>
          ) : null}
          {!s.enabled ? <Badge variant="muted">Programme off</Badge> : null}
        </>
      }
    >
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="numeric text-2xl font-semibold">{s.balance.toLocaleString("en-GB")}</p>
            <p className="text-muted-foreground">points · worth {formatAED(s.balanceValueFils)}</p>
          </div>
          {can(staff.permissions, "loyalty.adjust") ? (
            <PointsAdjustDialog customerId={customerId} />
          ) : null}
        </div>
        <p className="text-muted-foreground">
          {formatAED(s.spend12mFils)} spent in 12 months
          {s.nextTier ? ` · ${formatAED(s.nextTier.toGoFils)} to ${s.nextTier.name}` : ""}
        </p>
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <span>
            <span className="text-muted-foreground">Birthday </span>
            {birthday ? `${birthday.day} ${MONTHS[birthday.month - 1]}` : "—"}
          </span>
          {can(staff.permissions, "customers.manage") ? (
            <BirthdayEditor customerId={customerId} birthday={birthday} />
          ) : null}
        </div>
        {s.recent.length ? (
          <ul className="divide-y border-t">
            {s.recent.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  {POINTS_ENTRY_LABELS[e.entry]}
                  {e.orderId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/orders/${e.orderId}`}
                        className="underline underline-offset-4"
                      >
                        order
                      </Link>
                    </>
                  ) : null}
                  <span className="text-muted-foreground block truncate text-xs">
                    {formatBusinessDate(e.createdAt)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
                <span className="numeric shrink-0">
                  {e.points > 0 ? "+" : "−"}
                  {Math.abs(e.points).toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AdminSection>
  );
}
