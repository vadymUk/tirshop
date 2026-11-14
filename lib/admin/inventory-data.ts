import "server-only";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { InventoryFilter } from "@/lib/admin/inventory";

export async function fetchInventory(db: Awaited<ReturnType<typeof createClient>>, filter: InventoryFilter, offset: number, limit: number) {
  const result = await db.rpc("admin_inventory_list", {
    p_query: filter.query, p_status: filter.status, p_offset: offset, p_limit: limit,
  });
  if (result.error) throw new Error(`Не вдалося завантажити склад: ${result.error.message}`);
  return result.data;
}

export async function getInventory(filter: InventoryFilter, offset: number, limit: number) {
  await requireActiveAdmin();
  return fetchInventory(await createClient(), filter, offset, limit);
}
