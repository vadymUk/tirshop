"use server";

import { revalidatePath, updateTag } from "next/cache";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { parseInventoryAdjustment } from "@/lib/admin/inventory";
import { createClient } from "@/lib/supabase/server";

export type InventoryActionState = { error?: string; success?: string };

export async function adjustInventory(_state: InventoryActionState, form: FormData): Promise<InventoryActionState> {
  await authorizeAdminOperation("inventory-adjust");
  const parsed = parseInventoryAdjustment(form);
  if (!parsed.success) return { error: "Виберіть від 1 до 100 товарів, дію, цілу кількість та причину (до 1000 символів)." };
  const { items, operation, quantity, reason } = parsed.data;
  const result = await (await createClient()).rpc("admin_adjust_inventory", {
    p_ids: items.map((item) => item.id), p_expected: items.map((item) => item.stock),
    p_operation: operation, p_quantity: quantity, p_reason: reason,
  });
  if (result.error) {
    console.error("Inventory adjustment failed:", result.error);
    if (result.error.message.includes("stock_conflict")) return { error: "Залишок змінився. Оновіть сторінку та перевірте вибрані товари." };
    if (result.error.message.includes("invalid_resulting_stock")) return { error: "Операція призведе до від’ємного або надто великого залишку. Жоден товар не змінено." };
    if (result.error.message.includes("unchanged_stock")) return { error: "Для одного з товарів залишок не зміниться. Жоден товар не змінено." };
    return { error: "Не вдалося змінити залишки. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!result.data) return { error: "Забагато запитів. Спробуйте пізніше." };
  updateTag("products");
  for (const path of ["/admin", "/admin/inventory", "/admin/products", "/products"]) revalidatePath(path);
  for (const item of items) {
    revalidatePath(`/admin/inventory/${item.id}`);
    revalidatePath(`/admin/products/${item.id}/edit`);
  }
  return { success: "Залишки змінено та записано в історію." };
}
