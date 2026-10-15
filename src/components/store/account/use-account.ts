"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

export type AccountState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; firstName: string; email: string };

/*
 * The visitor's account state for client UI (header menu). Sign-in happens in server actions,
 * which set the session cookie; call `refreshAccount()` afterwards to re-read it.
 */
const LOADING: AccountState = { status: "loading" };
let state: AccountState = LOADING;
const listeners = new Set<() => void>();
let started = false;

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshAccount() {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return set({ status: "signed_out" });
  const first = (user.user_metadata?.first_name as string | undefined)?.trim();
  set({ status: "signed_in", firstName: first || user.email.split("@")[0], email: user.email });
}

export function useAccount(): AccountState {
  useEffect(() => {
    if (started) return;
    started = true;
    void refreshAccount();
    createClient().auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION") void refreshAccount();
    });
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => LOADING,
  );
}
