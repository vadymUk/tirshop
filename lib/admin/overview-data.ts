import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { overviewSchema, type OverviewFilter } from "@/lib/admin/overview";

export async function getDashboardOverview(filter: OverviewFilter) {
  await requireActiveAdmin();
  const db = await createClient();
  const result = await db.rpc("admin_dashboard_overview", {
    p_period: filter.period,
    p_from: filter.from ?? null,
    p_to: filter.to ?? null,
  });
  if (result.error) throw new Error(`Failed to load dashboard overview: ${result.error.message}`);
  return overviewSchema.parse(result.data);
}
