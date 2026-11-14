"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { settingsSchemas, settingsSection } from "@/lib/admin/settings-validation";
import { createClient } from "@/lib/supabase/server";

export async function saveStoreSettings(section: unknown, id: unknown, revision: unknown, input: unknown) {
  await authorizeAdminOperation("store-settings-save");
  const key = settingsSection.parse(section);
  const settingsId = z.string().uuid().parse(id);
  const updatedAt = z.string().datetime({ offset: true }).parse(revision);
  const parsed = settingsSchemas[key].safeParse(input);
  if (!parsed.success) throw new Error(`Перевірте поля: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const db = await createClient();
  const result = await db.from("site_settings").update(parsed.data).eq("id", settingsId)
    .eq("updated_at", updatedAt).select("updated_at").maybeSingle();
  if (result.error) throw new Error(`Не вдалося зберегти налаштування: ${result.error.message}`);
  if (!result.data) throw new Error("Налаштування змінилися. Оновіть сторінку та повторіть зміни.");
  if (key !== "behavior" && key !== "notifications") revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return result.data.updated_at;
}
