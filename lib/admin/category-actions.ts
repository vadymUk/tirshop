"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { categorySchema } from "@/lib/admin/category-validation";
import { createClient } from "@/lib/supabase/server";

export type CategoryState = { error?: string; success?: string };

function invalidate() {
  updateTag("categories");
  updateTag("products");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/");
  revalidatePath("/category/[slug]", "page");
}

export async function saveCategory(_state: CategoryState, form: FormData): Promise<CategoryState> {
  await authorizeAdminOperation("category-save");
  const parsed = categorySchema.safeParse({ ...Object.fromEntries(form), is_active: form.get("is_active") === "on" });
  if (!parsed.success) return { error: `Перевірте поля: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}.` };
  const { id, ...values } = parsed.data;
  const db = await createClient();
  const result = id
    ? await db.from("categories").update(values).eq("id", id).select("id").single()
    : await db.from("categories").insert(values).select("id").single();
  if (result.error) {
    console.error("Category save failed:", result.error);
    return { error: result.error.code === "23505" ? "Категорія з таким slug уже існує." : "Не вдалося зберегти категорію." };
  }
  invalidate();
  return { success: "Категорію збережено." };
}

export async function deleteCategory(_state: CategoryState, form: FormData): Promise<CategoryState> {
  await authorizeAdminOperation("category-delete");
  const parsed = z.object({
    id: z.string().uuid(),
    target: z.union([z.literal(""), z.string().uuid()]),
  }).safeParse({ id: form.get("id"), target: form.get("target") });
  if (!parsed.success || parsed.data.id === parsed.data.target) return { error: "Оберіть коректну категорію для перенесення." };
  const { data, error } = await (await createClient()).rpc("admin_delete_category", { p_id: parsed.data.id, p_target: parsed.data.target || null });
  if (error) {
    console.error("Category deletion failed:", error);
    if (error.message.includes("category_has_products")) return { error: "У категорії є товари. Оберіть іншу категорію для перенесення." };
    if (error.message.includes("category_has_image")) return { error: "Категорія має зображення. Видалення заблоковане до реалізації безпечного очищення." };
    return { error: "Не вдалося видалити категорію. Оновіть сторінку." };
  }
  if (!data) return { error: "Забагато запитів. Спробуйте пізніше." };
  invalidate();
  return { success: "Категорію видалено." };
}

export async function moveCategory(id: string, target: string): Promise<CategoryState> {
  await authorizeAdminOperation("category-reorder");
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(target).success || id === target) return { error: "Некоректний порядок категорій." };
  const { data, error } = await (await createClient()).rpc("admin_move_category", { p_id: id, p_target: target });
  if (error) {
    console.error("Category reorder failed:", error);
    return { error: "Не вдалося змінити порядок. Оновіть сторінку." };
  }
  if (!data) return { error: "Забагато запитів. Спробуйте пізніше." };
  invalidate();
  return { success: "Порядок змінено." };
}
