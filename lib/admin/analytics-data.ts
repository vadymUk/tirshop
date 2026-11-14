import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { analyticsSchema, type AnalyticsFilter } from "@/lib/admin/analytics";

export async function fetchEcommerceAnalytics(db: Awaited<ReturnType<typeof createClient>>, filter: AnalyticsFilter, offset = 0) {
  const result = await db.rpc("admin_ecommerce_analytics", {
    p_period: filter.period,
    p_from: filter.from ?? null,
    p_to: filter.to ?? null,
    p_currency: filter.currency ?? null,
    p_bucket: filter.bucket,
    p_offset: offset,
  });
  if (result.error) throw new Error(`Не вдалося завантажити аналітику: ${result.error.message}`);
  return analyticsSchema.parse(result.data);
}

export async function getEcommerceAnalytics(filter: AnalyticsFilter, offset = 0) {
  await requireActiveAdmin();
  return fetchEcommerceAnalytics(await createClient(), filter, offset);
}
