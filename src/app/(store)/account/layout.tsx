import { AccountNav } from "@/components/store/account/account-nav";

/** Account pages: baby-pink paper, a narrow column and tabs (My account · My orders · Passport). */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-solid-header className="on-blush flex-1">
      <div className="mx-auto w-full max-w-2xl px-6 py-10 sm:py-14">
        <AccountNav />
        {children}
      </div>
    </div>
  );
}
