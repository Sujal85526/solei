import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PassportStamp } from "@/components/brand";
import { LedgerList, RewardStatusBadge } from "@/components/admin/loyalty/ledger";
import {
  AdjustStampsDialog,
  IssuePassportButton,
  RedeemRewardDialog,
} from "@/components/admin/loyalty/loyalty-forms";
import { AdminSection } from "@/components/admin/section";
import { requireStaff } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { progress } from "@/modules/loyalty/engine";
import {
  getCustomerLoyalty,
  getPublicProgramme,
  listDestinations,
  rewardOptions,
} from "@/modules/loyalty/queries";
import { isItemReward, passportHowLabels, rewardValueText } from "@/modules/loyalty/schema";

/**
 * Solei Passport on the customer profile: progress on the current card, passport status,
 * rewards (redeem) and the latest ledger entries. Needs loyalty.view; adjusting and issuing
 * need loyalty.adjust; redeeming loyalty.adjust or pos.use.
 */
export async function PassportPanel({ customerId }: { customerId: string }) {
  const staff = await requireStaff();
  if (!can(staff.permissions, "loyalty.view")) return null;
  const canAdjust = can(staff.permissions, "loyalty.adjust");
  const canRedeem = canAdjust || can(staff.permissions, "pos.use");

  const [card, programme, destinations] = await Promise.all([
    getCustomerLoyalty(customerId, { ledgerLimit: 5, staff: true }),
    getPublicProgramme(),
    canAdjust ? listDestinations() : Promise.resolve([]),
  ]);
  const available = card.rewards.filter((r) => r.status === "available");
  const options = canRedeem
    ? await Promise.all(
        available.map((r) => (isItemReward(r.type) ? rewardOptions(r.id) : Promise.resolve([]))),
      )
    : [];
  const threshold = programme.rule?.stampsForReward ?? 12;
  const p = progress(card.balance, threshold);
  const maxRemovable = Math.max(
    0,
    card.balance + available.reduce((sum, r) => sum + r.stampsCost, 0),
  );

  return (
    <AdminSection
      title="Solei Passport"
      description={
        card.passport
          ? `${card.passport.number} · issued ${passportHowLabels[card.passport.how].toLowerCase()} on ${formatBusinessDate(card.passport.issuedAt)}${card.passport.by ? ` by ${card.passport.by}` : ""}`
          : "No passport issued yet"
      }
    >
      <div className="flex flex-col gap-5" data-testid="passport-panel">
        {!programme.enabled ? (
          <p className="rounded-lg bg-[#B4690E]/10 px-3 py-2 text-sm">
            The programme is switched off — no stamps are being awarded.
          </p>
        ) : null}
        <div className="flex items-center gap-4">
          <PassportStamp
            label={`${p.collected}/${p.total}`}
            sublabel="stamps"
            variant={p.collected ? "filled" : "empty"}
            tilt={-4}
            className="w-20 shrink-0"
          />
          <div className="text-sm">
            <p className="numeric text-2xl font-semibold" data-testid="passport-progress">
              {p.collected} / {p.total}
            </p>
            <p className="text-muted-foreground">
              {p.remaining} more to {programme.rule?.rewardLabel ?? "the next reward"}
            </p>
            {card.balance < 0 ? (
              <p className="text-muted-foreground text-xs">
                {Math.abs(card.balance)} stamps owed after a reversal.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">{card.collected} collected in total</p>
          </div>
        </div>

        {canAdjust ? (
          <div className="flex flex-wrap gap-2">
            <AdjustStampsDialog
              customerId={customerId}
              destinations={destinations}
              maxRemovable={maxRemovable}
            />
            {!card.passport ? <IssuePassportButton customerId={customerId} /> : null}
          </div>
        ) : null}

        {card.rewards.length ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Rewards</h3>
            <ul className="flex flex-col gap-2">
              {card.rewards.slice(0, 4).map((r) => {
                const i = available.indexOf(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{r.label}</p>
                      <p className="text-muted-foreground text-xs">
                        Unlocked {formatBusinessDate(r.createdAt)}
                        {r.redeemedOrder ? ` · used on ${r.redeemedOrder.number}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <RewardStatusBadge status={r.status} />
                      {r.status === "available" && canRedeem ? (
                        <RedeemRewardDialog
                          customerId={customerId}
                          reward={{
                            id: r.id,
                            label: r.label,
                            isItem: isItemReward(r.type),
                            valueText: rewardValueText(r.type, r.config),
                          }}
                          options={options[i] ?? []}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Latest stamps</h3>
          <LedgerList entries={card.ledger} />
          {card.ledgerTotal > 0 ? (
            <Link
              href={`/admin/customers/${customerId}/passport`}
              className="text-burgundy inline-flex min-h-11 items-center gap-1 text-sm font-medium"
            >
              Full ledger ({card.ledgerTotal}) <ChevronRight className="size-4 rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
      </div>
    </AdminSection>
  );
}
