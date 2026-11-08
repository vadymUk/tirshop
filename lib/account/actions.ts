"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import type { ActionResult } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validations/profile";

/** Updates only the caller's own profile; the id always comes from the verified session. */
export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Виправте виділені поля.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Увійдіть, щоб змінити профіль." };

  const supabase = await createClient();
  // RLS and column grants (full_name, phone) enforce this again in the database.
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    if (error) console.error("updateProfile failed:", error.code);
    return { success: false, error: "Не вдалося зберегти зміни. Спробуйте ще раз." };
  }

  revalidatePath("/account");
  return { success: true, message: "Профіль оновлено." };
}