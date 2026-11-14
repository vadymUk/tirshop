import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActivityFilter } from "@/lib/admin/activity";

export async function fetchActivity(db: Awaited<ReturnType<typeof createClient>>, filter: ActivityFilter, offset: number, limit: number) {
  const result = await db.rpc("admin_activity_list", {
    p_admin: filter.admin || null, p_action: filter.action, p_entity: filter.entity,
    p_from: filter.from || null, p_to: filter.to || null, p_query: filter.query,
    p_offset: offset, p_limit: limit,
  });
  if (result.error) throw new Error(`Не вдалося завантажити журнал: ${result.error.message}`);
  return result.data;
}

export async function getActivity(filter: ActivityFilter, offset: number, limit: number) {
  await requireActiveAdmin();
  return fetchActivity(await createClient(), filter, offset, limit);
}
