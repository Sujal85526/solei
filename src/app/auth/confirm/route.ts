import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeLocalPath } from "@/modules/auth/schema";
import { createClient } from "@/lib/supabase/server";

const ALLOWED: EmailOtpType[] = [
  "invite",
  "recovery",
  "magiclink",
  "email",
  "signup",
  "email_change",
];

/** Verifies email links (invite, password reset, magic link) server-side and sets the session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeLocalPath(searchParams.get("next"), "/admin");

  if (tokenHash && type && ALLOWED.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  const fallback = next.startsWith("/admin") ? "/admin/login?error=link" : "/passport?error=link";
  return NextResponse.redirect(new URL(fallback, request.url));
}
