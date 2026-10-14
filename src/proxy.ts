import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Public admin routes that must stay reachable without a session. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password"];

/**
 * Refreshes the Supabase session cookie on every matched request and keeps signed-out
 * visitors out of /admin. Authorisation (staff, MFA, permissions) is enforced again on the
 * server for every page, action and RPC — this is only the first gate.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Validates the JWT and refreshes it if needed. Do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdmin && !signedIn && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search =
      pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*", "/passport/:path*", "/account/:path*"],
};
