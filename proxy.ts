import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  const match = /^\/products\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
  if (!match || (request.method !== "GET" && request.method !== "HEAD")) return response;

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return response;
  }

  const { data, error } = await createPublicClient()
    .from("products")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to verify product URL:", error.message);
    const unavailable = new NextResponse("Unable to verify product availability.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.getAll().forEach((cookie) => unavailable.cookies.set(cookie));
    return unavailable;
  }
  if (data) return response;

  // Set the status before streaming while letting Next render its usual not-found UI.
  const url = request.nextUrl.clone();
  url.pathname = "/__product-not-found__/__missing__";
  const notFound = NextResponse.rewrite(url, { status: 404 });
  response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie));
  return notFound;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
