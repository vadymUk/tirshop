import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Verified user (token validated with Supabase), or null. Deduped per request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Lightweight identity for display and RLS-scoped reads: the JWT signature is verified
 * (no Auth server round trip). Mutations and account pages still use getCurrentUser().
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** Returns the user or redirects to login, preserving the return path. */
export async function requireUser(returnTo?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const query = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/auth/login${query}`);
  }
  return user;
}

/** Profile row of the signed-in user (RLS-scoped), or null. */
export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  return data;
});
