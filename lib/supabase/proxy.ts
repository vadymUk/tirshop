import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

const PROTECTED_PREFIXES = [
  "/favorites",
  "/cart",
  "/checkout",
  "/account",
  "/admin",
];
// Signed-in users have no reason to see these.
const GUEST_ONLY_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Refreshes the Supabase session cookies and guards protected routes. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies the JWT signature (locally with asymmetric keys, refreshing when expired);
  // it avoids an Auth server round trip on every request. Never trust getSession() here.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, query?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = query ?? "";
    const redirect = NextResponse.redirect(url);
    // Keep refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    return redirectTo(
      "/auth/login",
      `?next=${encodeURIComponent(pathname + search)}`,
    );
  }

  if (user && GUEST_ONLY_PATHS.some((p) => matches(pathname, p))) {
    return redirectTo("/account");
  }

  return response;
}
