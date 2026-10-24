import type { Metadata } from "next";
import Link from "next/link";
import { GiftCardSettingsForm } from "@/components/admin/gift-cards/gift-card-forms";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getGiftCardSettings } from "@/modules/gift-cards/queries";

export const metadata: Metadata = { title: "Gift card settings" };

export default async function GiftCardSettingsPage() {
  await requirePagePermission("gift_cards.manage");
  const settings = await getGiftCardSettings();
  return (
    <>
      <PageHeader
        title="Gift card settings"
        description={
          <>
            <Link href="/admin/gift-cards" className="underline underline-offset-4">
              Gift cards
            </Link>{" "}
            · Changes apply to cards sold from now on; existing cards keep their expiry.
          </>
        }
      />
      <div className="max-w-3xl">
        <GiftCardSettingsForm settings={settings} />
      </div>
    </>
  );
}
