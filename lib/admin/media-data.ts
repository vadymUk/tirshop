import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { mediaFilters } from "@/lib/admin/media-shared";

export async function listMedia(filters: ReturnType<typeof mediaFilters>) {
  await requireActiveAdmin();
  const result = await (await createClient()).rpc("admin_media_list", {
    p_bucket: filters.bucket, p_query: filters.query, p_type: filters.type,
    p_ascending: filters.ascending, p_orphan: filters.orphan, p_offset: (filters.page - 1) * 20,
  });
  if (result.error) throw new Error(`Failed to load media: ${result.error.message}`);
  return { rows: result.data.slice(0, 20), hasNext: result.data.length > 20 };
}
