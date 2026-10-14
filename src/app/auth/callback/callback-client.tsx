"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeLocalPath } from "@/modules/auth/schema";

export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = safeLocalPath(params.get("next"), "/admin");
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const fail = (message: string) =>
      setError(message || "This link is invalid or has expired. Ask for a new one.");

    (async () => {
      if (hash.get("error_description")) return fail(hash.get("error_description")!);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return fail(error.message);
      } else if (hash.get("access_token") && hash.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        });
        if (error) return fail(error.message);
      } else {
        return fail("");
      }
      // Drop tokens from the address bar before moving on.
      window.history.replaceState(null, "", window.location.pathname);
      router.replace(next);
      router.refresh();
    })();
  }, [params, router]);

  if (error) {
    return (
      <div className="flex max-w-sm flex-col gap-3">
        <h1 className="text-3xl">Link expired</h1>
        <p className="text-ink-muted text-sm">{error}</p>
        <a href="/admin/login" className="eyebrow text-burgundy underline underline-offset-4">
          Back to sign in
        </a>
      </div>
    );
  }
  return <p className="font-display text-burgundy text-xl italic">Signing you in…</p>;
}
