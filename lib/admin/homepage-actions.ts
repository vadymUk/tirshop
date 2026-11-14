"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { homepageSchema } from "@/lib/homepage/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function saveHomepageDraft(input: unknown, revision: number) {
  await authorizeAdminOperation("homepage-save");
  const parsed = homepageSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Перевірте дані: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647) throw new Error("Некоректна версія чернетки.");
  const db = await createClient();
  const result = revision === 0
    ? await db.from("homepage_draft").insert({ singleton: true, document: parsed.data, revision: 1 }).select("revision").single()
    : await db.from("homepage_draft").update({ document: parsed.data, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq("singleton", true).eq("revision", revision).select("revision").maybeSingle();
  if (result.error || !result.data) {
    if (result.error?.code === "23505" || !result.error) throw new Error("Чернетку змінив інший адміністратор. Оновіть сторінку.");
    throw new Error(`Не вдалося зберегти чернетку: ${result.error.message}`);
  }
  revalidatePath("/admin/homepage");
  return result.data.revision;
}

export async function publishHomepage(revision: number) {
  const admin = await authorizeAdminOperation("homepage-publish");
  if (!z.number().int().positive().safeParse(revision).success) throw new Error("Спочатку збережіть чернетку.");
  const draft = await (await createClient()).from("homepage_draft").select("document,revision").eq("singleton", true).maybeSingle();
  if (draft.error) throw new Error(`Не вдалося завантажити чернетку: ${draft.error.message}`);
  if (!draft.data || draft.data.revision !== revision) throw new Error("Чернетку змінено. Оновіть сторінку.");
  const document = homepageSchema.parse(draft.data.document);
  const result = await createAdminClient().rpc("publish_homepage", { p_revision: revision, p_document: document, p_actor: admin.id });
  if (result.error || !result.data) throw new Error(`Не вдалося опублікувати: ${result.error?.message ?? "немає підтвердження"}`);
  updateTag("homepage");
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}
