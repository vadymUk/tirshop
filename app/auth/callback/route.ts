import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/redirect";
import { absoluteUrl } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Handles Supabase email links, both PKCE (`?code=`) and token-hash
 * (`?token_hash=&type=`) flavours: verification, password recovery, etc.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(
    searchParams.get("next"),
    type === "recovery" ? "/auth/reset-password" : "/account",
  );

  const supabase = await createClient();
  let error: unknown = new Error("Missing auth parameters");

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  }

  if (!error) return NextResponse.redirect(absoluteUrl(next));
  return NextResponse.redirect(absoluteUrl("/auth/login?error=link_invalid"));
}
