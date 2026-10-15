"use client";

import { useRouter } from "next/navigation";
import { AccountForms, type AccountMode } from "./account-forms";
import { refreshAccount } from "./use-account";

/** Sign in / create account in place (account page, checkout); reloads the page's data after. */
export function AccountGate({
  initialMode = "signIn",
  onSignedIn,
}: {
  initialMode?: AccountMode;
  onSignedIn?: () => void;
}) {
  const router = useRouter();
  return (
    <AccountForms
      initialMode={initialMode}
      onSignedIn={async () => {
        await refreshAccount();
        onSignedIn?.();
        router.refresh();
      }}
    />
  );
}
