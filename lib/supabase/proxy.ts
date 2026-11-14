import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

const PROTECTED_PREFIXES = [
  "/favorites",
  "/cart",
  "/checkout",
  "/account",
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
    redirect.headers.set("Cache-Control", "private, no-store");
    // Keep refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (matches(pathname, "/admin")) {
    const reject = (status: number, title: string) => {
      const denied = new NextResponse(
        `<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui;max-width:36rem;margin:5rem auto;padding:0 1rem"><h1>${title}</h1><p><a href="/auth/login?next=%2Fadmin">Увійти</a> · <a href="/">Магазин</a></p></body></html>`,
        { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } },
      );
      response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
      return denied;
    };

    if (!user) return reject(401, "401 — Потрібен вхід");
    const verified = await supabase.auth.getUser();
    if (verified.error || !verified.data.user) {
      console.error("Failed to verify admin session:", verified.error?.message ?? "missing user");
      return reject(503, "Не вдалося перевірити доступ");
    }
    const admin = await supabase.rpc("is_active_admin");
    if (admin.error) {
      console.error("Failed to verify admin role:", admin.error.message);
      return reject(503, "Не вдалося перевірити доступ");
    }
    if (!admin.data) return reject(403, "403 — Доступ заборонено");
  }

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
