import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Settings } from "lucide-react";
import { GiftCardStateBadge } from "@/components/admin/gift-cards/gift-card-state-badge";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { giftCardSummary, listGiftCards } from "@/modules/gift-cards/queries";
import { giftCardState } from "@/modules/gift-cards/schema";

export const metadata: Metadata = { title: "Gift cards" };

export default async function GiftCardsPage({ searchParams }: PageProps<"/admin/gift-cards">) {
  const staff = await requirePagePermission("gift_cards.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const [cards, summary] = await Promise.all([listGiftCards(q), giftCardSummary()]);
  const manage = can(staff.permissions, "gift_cards.manage");

  return (
    <>
      <PageHeader
        title="Gift cards"
        description="Cards sold on the website and issued by staff, with what's left on each."
        actions={
          manage ? (
            <>
              <Link
                href="/admin/gift-cards/settings"
                className={buttonVariants({ variant: "outline" })}
              >
                <Settings /> Settings
              </Link>
              <Link href="/admin/gift-cards/new" className={buttonVariants()}>
                <Plus /> Issue gift card
              </Link>
            </>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live cards" value={summary.activeCards} />
        <StatCard
          label="Still to spend"
          value={formatAED(summary.outstandingFils)}
          hint="Balance on live cards"
        />
        <StatCard label="Issued this month" value={formatAED(summary.soldThisMonthFils)} />
        <StatCard label="Spent this month" value={formatAED(summary.redeemedThisMonthFils)} />
      </div>

      <form method="get" role="search" aria-label="Find a gift card" className="mb-5 max-w-md">
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search code, recipient name or email"
          aria-label="Search gift cards"
          className="h-10"
        />
      </form>

      {cards.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center">
          <p className="font-medium">{q ? "No gift cards match" : "No gift cards yet"}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Cards appear here once they&apos;re paid for on the website or issued by staff.
          </p>
        </div>
      ) : (
        <ul className="bg-card divide-y rounded-xl border">
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/gift-cards/${c.id}`}
                className="hover:bg-muted/50 flex items-center gap-4 px-5 py-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono font-medium">{c.code}</span>
                    <span className="numeric text-sm">
                      {formatAED(c.balanceFils)}
                      <span className="text-muted-foreground"> of {formatAED(c.initialFils)}</span>
                    </span>
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {[
                      c.recipientName || c.recipientEmail,
                      c.purchaseOrder ? `Sold · ${c.purchaseOrder.number}` : "Issued by staff",
                      c.expiresAt ? `expires ${formatBusinessDate(c.expiresAt)}` : "no expiry",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <GiftCardStateBadge state={giftCardState(c, c.balanceFils)} />
                <ChevronRight className="text-muted-foreground size-4 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
