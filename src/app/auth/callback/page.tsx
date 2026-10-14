import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "./callback-client";

export const metadata: Metadata = { title: "Signing you in…", robots: { index: false } };

/**
 * Landing page for Supabase's default email links (invite, password reset, magic link).
 * Handles both the implicit flow (`#access_token=…`) and PKCE (`?code=…`), then continues to `next`.
 * Branded templates that link to /auth/confirm (token_hash) work too — see supabase/templates.
 */
export default function AuthCallbackPage() {
  return (
    <main className="bg-cream flex min-h-dvh items-center justify-center px-6 text-center">
      <Suspense>
        <AuthCallback />
      </Suspense>
    </main>
  );
}
