import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getServerEnv, publicEnv } from "@/lib/env";

/**
 * Privileged client that bypasses RLS. Server-only: use exclusively for trusted
 * operations (e.g. order creation, webhooks) after authorizing the caller.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getServerEnv().SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
