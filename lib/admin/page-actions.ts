"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeAdminOperation } from "@/lib/admin/security";
import { pageDocumentSchema, pageHref } from "@/lib/pages/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const uuid = z.string().uuid();
const json = (value: unknown): Json => JSON.parse(JSON.stringify(value));

export async function savePageDraft(id: string, input: unknown, revision: number) {
  await authorizeAdminOperation("page-save");
  uuid.parse(id);
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= 2147483647) throw new Error("Некоректна версія чернетки.");
  const parsed = pageDocumentSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Перевірте дані: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const db = await createClient();
  const document = json(parsed.data);
  const result = revision === 0
    ? await db.from("page_drafts").insert({ id, document, revision: 1 }).select("revision").single()
    : await db.from("page_drafts").update({ document, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq("id", id).eq("revision", revision).select("revision").maybeSingle();
  if (result.error || !result.data) {
    if (result.error?.code === "23505" || !result.error) throw new Error("Чернетку змінив інший адміністратор. Оновіть сторінку.");
    throw new Error(`Не вдалося зберегти чернетку: ${result.error.message}`);
  }
  revalidatePath("/admin/pages");
  return result.data.revision;
}

export async function publishPage(id: string, revision: number) {
  const admin = await authorizeAdminOperation("page-publish");
  uuid.parse(id);
  z.number().int().positive().parse(revision);
  const db = await createClient();
  const [draft, old] = await Promise.all([
    db.from("page_drafts").select("document,revision").eq("id", id).maybeSingle(),
    db.from("pages").select("slug").eq("id", id).maybeSingle(),
  ]);
  if (draft.error || old.error) throw new Error(`Не вдалося завантажити сторінку: ${draft.error?.message ?? old.error?.message}`);
  if (!draft.data || draft.data.revision !== revision) throw new Error("Чернетку змінено. Оновіть сторінку.");
  const document = pageDocumentSchema.parse(draft.data.document);
  const result = await createAdminClient().rpc("admin_publish_page", { p_id: id, p_revision: revision, p_document: draft.data.document, p_actor: admin.id });
  if (result.error || !result.data) throw new Error(`Не вдалося опублікувати: ${result.error?.message ?? "немає підтвердження"}`);
  if (old.data) revalidatePath(pageHref(old.data.slug));
  revalidatePath(pageHref(document.slug));
  revalidatePath("/admin/pages");
}

export async function operatePage(id: string, operation: "unpublish" | "delete") {
  await authorizeAdminOperation(`page-${operation}`);
  uuid.parse(id);
  z.enum(["unpublish", "delete"]).parse(operation);
  const db = await createClient();
  const page = await db.from("pages").select("slug").eq("id", id).maybeSingle();
  if (page.error) throw new Error(`Не вдалося завантажити сторінку: ${page.error.message}`);
  const result = await db.rpc("admin_page_operation", { p_id: id, p_operation: operation });
  if (result.error || !result.data) throw new Error(`Операцію не виконано: ${result.error?.message ?? "немає підтвердження"}`);
  if (page.data) revalidatePath(pageHref(page.data.slug));
  revalidatePath("/admin/pages");
}
