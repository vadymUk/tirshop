import "server-only";
import { cache } from "react";
import { forbidden, unauthorized } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type AdminAccess = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> | null;
  isActiveAdmin: boolean;
};

const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const user = await getCurrentUser();
  if (!user) return { user: null, isActiveAdmin: false };

  const supabase = await createClient();
  const { data: isActiveAdmin, error } = await supabase.rpc("is_active_admin");

  if (error) throw new Error(`Failed to verify administrator access: ${error.message}`);

  return { user, isActiveAdmin };
});

/** Returns the verified Supabase user only when their database profile is an active admin. */
export async function getAdminUser() {
  const access = await getAdminAccess();
  return access.isActiveAdmin ? access.user : null;
}

/** Requires a signed-in active admin as determined by public.profiles on the server. */
export async function requireAdmin() {
  const access = await getAdminAccess();
  if (!access.user) unauthorized();
  if (!access.isActiveAdmin) forbidden();
  return access.user;
}

/** Requires a signed-in administrator whose profile is active. */
export async function requireActiveAdmin() {
  return requireAdmin();
}

/** Checks active administrator status without throwing. */
export async function isAdmin() {
  return Boolean(await getAdminUser());
}
