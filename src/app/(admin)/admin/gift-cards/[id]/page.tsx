import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GiftCardActions } from "@/components/admin/gift-cards/gift-card-actions";
import { GiftCardStateBadge } from "@/components/admin/gift-cards/gift-card-state-badge";
import { PageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/section";
import { requirePagePermission } from "@/lib/auth/session";
import { formatBusinessDate } from "@/lib/dates";
import { formatAED } from "@/lib/money";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getGiftCard } from "@/modules/gift-cards/queries";
import { giftCardState, LEDGER_LABELS } from "@/modules/gift-cards/schema";

export const metadata: Metadata = { title: "Gift card" };

export default async function GiftCardPage({ params }: PageProps<"/admin/gift-cards/[id]">) {
  const staff = await requirePagePermission("gift_cards.view");
  const { id } = await params;
  const card = await getGiftCard(id);
  if (!card) notFound();
  const state = giftCardState(card, card.balanceFils);

  const facts: [string, React.ReactNode][] = [
    ["Status", <GiftCardStateBadge key="s" state={state} />],
    [
      "Balance",
      <span key="b" className="numeric">
        {formatAED(card.balanceFils)}
      </span>,
    ],
    [
      "Value",
      <span key="v" className="numeric">
        {formatAED(card.initialFils)}
      </span>,
    ],
    ["Expires", card.expiresAt ? formatBusinessDate(card.expiresAt) : "Never"],
    [
      "From",
      card.purchaseOrder ? (
        <Link
          key="o"
          href={`/admin/orders/${card.purchaseOrder.id}`}
          className="underline underline-offset-4"
        >
          Sold online · {card.purchaseOrder.number}
        </Link>
      ) : (
        "Issued by staff"
      ),
    ],
    ["For", [card.recipientName, card.recipientEmail].filter(Boolean).join(" · ") || "—"],
    ["Emailed", card.sentAt ? formatBusinessDate(card.sentAt) : "Not yet"],
  ];

  return (
    <>
      <PageHeader
        title={card.code}
        description={
          <>
            <Link href="/admin/gift-cards" className="underline underline-offset-4">
              Gift cards
            </Link>{" "}
            · {formatAED(card.initialFils)} gift card
          </>
        }
        actions={
          can(staff.permissions, "gift_cards.manage") ? (
            <GiftCardActions
              id={card.id}
              code={card.code}
              balanceFils={card.balanceFils}
              active={card.status === "active"}
              recipientEmail={card.recipientEmail}
            />
          ) : null
        }
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <aside className="bg-card flex flex-col gap-3 rounded-xl border p-5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span className="min-w-0 text-end break-words">{value}</span>
            </div>
          ))}
          {card.message ? (
            <p className="text-muted-foreground border-t pt-3 text-xs italic">“{card.message}”</p>
          ) : null}
          {card.note ? <p className="text-muted-foreground text-xs">Note: {card.note}</p> : null}
          {card.voidReason ? (
            <p className="text-muted-foreground text-xs">Voided: {card.voidReason}</p>
          ) : null}
        </aside>

        <AdminSection title="History" description="Every change to the balance, oldest first.">
          <ul className="divide-y text-sm">
            {card.ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{LEDGER_LABELS[l.entry]}</span>
                  {l.order ? (
                    <>
                      {" · "}
                      <Link
                        href={`/admin/orders/${l.order.id}`}
                        className="underline underline-offset-4"
                      >
                        {l.order.number}
                      </Link>
                    </>
                  ) : null}
                  <span className="text-muted-foreground block text-xs">
                    {formatBusinessDate(l.createdAt, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {l.note ? ` · ${l.note}` : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "numeric shrink-0",
                    l.amountFils > 0 ? "text-[#2f6b45]" : "text-foreground",
                  )}
                >
                  {l.amountFils > 0 ? "+" : "−"}
                  {formatAED(Math.abs(l.amountFils))}
                </span>
              </li>
            ))}
          </ul>
        </AdminSection>
      </div>
    </>
  );
}
