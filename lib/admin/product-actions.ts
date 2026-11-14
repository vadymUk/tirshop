"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { createClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/admin/product-validation";

export type ProductActionState = { error?: string; success?: string };

function invalidateCatalog() {
  updateTag("products");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function saveProduct(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  await authorizeAdminOperation("product-save");
  const parsed = productSchema.safeParse({
    ...Object.fromEntries(form.entries()),
    is_active: form.get("is_active") === "on",
    is_featured: form.get("is_featured") === "on",
  });
  if (!parsed.success) return { error: `Перевірте поля: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}.` };
  const { id, stock_quantity, expected_stock, ...product } = parsed.data;
  const db = await createClient();
  const { data, error } = await db.rpc("admin_save_product", {
    p_id: id || null, p_product: product, p_stock: stock_quantity,
    p_expected_stock: expected_stock === "" ? null : expected_stock,
  });
  if (error) {
    console.error("Product save failed:", error);
    if (error.code === "23505") return { error: "Slug або SKU вже використовується іншим товаром." };
    if (error.message.includes("stock_conflict")) return { error: "Залишок змінився після відкриття форми. Оновіть сторінку та перевірте значення." };
    return { error: "Не вдалося зберегти товар. Перевірте дані та спробуйте ще раз." };
  }
  if (!data) return { error: "Забагато запитів. Спробуйте пізніше." };
  invalidateCatalog();
  redirect(`/admin/products/${data}/edit?saved=1`);
}

export async function bulkProducts(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  await authorizeAdminOperation("product-bulk");
  const parsed = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    operation: z.enum(["activate", "deactivate", "delete"]),
  }).safeParse({ ids: form.getAll("ids"), operation: form.get("operation") });
  if (!parsed.success) return { error: "Виберіть від 1 до 100 товарів та дію." };
  const { data, error } = await (await createClient()).rpc("admin_bulk_products", {
    p_ids: parsed.data.ids,
    p_operation: parsed.data.operation,
  });
  if (error) {
    console.error("Bulk product operation failed:", error);
    if (error.message.includes("product_has_orders")) return { error: "Товар є в історії замовлень. Деактивуйте його замість видалення." };
    if (error.message.includes("product_has_images")) return { error: "Товар має зображення. Їх безпечне видалення з інтерфейсу ще не підключене; фізичне видалення заблоковано." };
    return { error: "Не вдалося виконати операцію. Оновіть сторінку та спробуйте ще раз." };
  }
  if (!data) return { error: "Забагато запитів. Спробуйте пізніше." };
  invalidateCatalog();
  return { success: "Операцію виконано." };
}

export async function saveLowStockThreshold(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  await authorizeAdminOperation("product-stock-threshold");
  const parsed = z.string().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().int().min(0).max(1_000_000)).safeParse(form.get("threshold"));
  if (!parsed.success) return { error: "Вкажіть цілий поріг від 0 до 1 000 000." };
  const result = await (await createClient()).from("site_settings")
    .update({ low_stock_threshold: parsed.data }).eq("singleton", true).select("id").single();
  if (result.error) {
    console.error("Low-stock threshold update failed:", result.error);
    return { error: "Не вдалося зберегти поріг залишку." };
  }
  revalidatePath("/admin/products");
  return { success: "Поріг збережено." };
}
