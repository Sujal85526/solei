import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatBusinessDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { RewardStatus, StampKind } from "@/modules/loyalty/engine";
import { signedStamps } from "@/modules/loyalty/format";
import type { LedgerEntry } from "@/modules/loyalty/queries";
import { rewardStatusLabels, stampKindLabels } from "@/modules/loyalty/schema";

const kindVariant: Record<StampKind, "success" | "secondary" | "destructive" | "pink" | "muted"> =
  {
    earned: "success",
    manual: "secondary",
    reversed: "destructive",
    redeemed: "pink",
    expired: "muted",
  };

export function StampKindBadge({ kind }: { kind: StampKind }) {
  return <Badge variant={kindVariant[kind]}>{stampKindLabels[kind]}</Badge>;
}

const rewardVariant: Record<RewardStatus, "success" | "muted" | "pink" | "destructive"> = {
  available: "pink",
  redeemed: "success",
  expired: "muted",
  revoked: "destructive",
};

export function RewardStatusBadge({ status }: { status: RewardStatus }) {
  return <Badge variant={rewardVariant[status]}>{rewardStatusLabels[status]}</Badge>;
}

const dateTime = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
} as const;

/** Stamp ledger rows: what, why, order, destination, who, when. */
export function LedgerList({
  entries,
  showCustomer = false,
  className,
}: {
  entries: LedgerEntry[];
  showCustomer?: boolean;
  className?: string;
}) {
  if (!entries.length) {
    return <p className="text-muted-foreground text-sm">No stamps yet.</p>;
  }
  return (
    <ul className={cn("divide-y", className)} aria-label="Stamp ledger">
      {entries.map((e) => (
        <li key={e.id} className="grid grid-cols-[3rem_1fr] items-start gap-3 py-3">
          <span
            className={cn(
              "numeric pt-0.5 text-end text-lg font-semibold",
              e.stamps > 0 ? "text-[#2F6B3A]" : "text-muted-foreground",
            )}
          >
            {signedStamps(e.stamps)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StampKindBadge kind={e.kind} />
              {e.destination ? <span className="text-sm font-medium">{e.destination}</span> : null}
              {e.order ? (
                <Link
                  href={`/admin/orders/${e.order.id}`}
                  className="text-muted-foreground hover:text-foreground font-mono text-xs underline-offset-2 hover:underline"
                >
                  {e.order.number}
                </Link>
              ) : null}
              {showCustomer && e.customer ? (
                <Link
                  href={`/admin/customers/${e.customer.id}`}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  {e.customer.name ?? "Customer"}
                </Link>
              ) : null}
            </div>
            {e.reason ? <p className="text-sm break-words">{e.reason}</p> : null}
            <p className="text-muted-foreground text-xs">
              <time dateTime={e.createdAt}>{formatBusinessDate(e.createdAt, dateTime)}</time>
              {e.by ? ` · by ${e.by}` : ""}
              {e.ruleVersion ? ` · rules v${e.ruleVersion}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
