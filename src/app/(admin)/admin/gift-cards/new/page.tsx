import type { Metadata } from "next";
import Link from "next/link";
import { IssueGiftCardForm } from "@/components/admin/gift-cards/gift-card-forms";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getGiftCardSettings } from "@/modules/gift-cards/queries";

export const metadata: Metadata = { title: "Issue gift card" };

export default async function IssueGiftCardPage() {
  await requirePagePermission("gift_cards.manage");
  const settings = await getGiftCardSettings();
  return (
    <>
      <PageHeader
        title="Issue gift card"
        description={
          <>
            <Link href="/admin/gift-cards" className="underline underline-offset-4">
              Gift cards
            </Link>{" "}
            · A goodwill gesture, a prize or a card paid for in person. Live at once.
          </>
        }
      />
      <div className="max-w-3xl">
        <IssueGiftCardForm expiryMonths={settings.expiryMonths} />
      </div>
    </>
  );
}
