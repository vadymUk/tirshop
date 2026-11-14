import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireActiveAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { pageDocumentSchema, pageSlug, type PageDocument } from "@/lib/pages/schema";
import type { Database } from "@/types/database";

type PageRow = Database["public"]["Tables"]["pages"]["Row"];

function fromRow(row: PageRow): PageDocument {
  const content = row.rich_content ?? {
    type: "doc",
    content: row.content.split(/\n{2,}/).map((text) => ({
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    })),
  };
  return pageDocumentSchema.parse({
    slug: row.slug, title: row.title, excerpt: row.excerpt ?? "", content,
    featured_image_path: row.featured_image_path ?? "", meta_title: row.meta_title ?? "",
    meta_description: row.meta_description ?? "", canonical_url: row.canonical_url ?? "",
    og_image_path: row.og_image_path ?? "",
    published_at: row.published_at ? new Date(row.published_at).toISOString() : "",
  });
}

export async function listPageEditor() {
  await requireActiveAdmin();
  const db = await createClient();
  const [pages, drafts] = await Promise.all([
    db.from("pages").select("*", { count: "exact" }).order("title"),
    db.from("page_drafts").select("*", { count: "exact" }).order("updated_at", { ascending: false }),
  ]);
  if (pages.error || drafts.error) throw new Error(`Не вдалося завантажити сторінки: ${pages.error?.message ?? drafts.error?.message}`);
  if ((pages.count !== null && pages.count > pages.data.length) || (drafts.count !== null && drafts.count > drafts.data.length)) {
    throw new Error("Список сторінок перевищує ліміт Supabase. Налаштуйте пагінацію перед продовженням.");
  }
  const rows = new Map(pages.data.map((row) => [row.id, { id: row.id, document: fromRow(row), published: row.is_published }]));
  for (const draft of drafts.data) {
    rows.set(draft.id, { id: draft.id, document: pageDocumentSchema.parse(draft.document), published: rows.get(draft.id)?.published ?? false });
  }
  return [...rows.values()];
}

export async function getPageEditor(id: string) {
  await requireActiveAdmin();
  if (!z.string().uuid().safeParse(id).success) return null;
  const db = await createClient();
  const [draft, page] = await Promise.all([
    db.from("page_drafts").select("*").eq("id", id).maybeSingle(),
    db.from("pages").select("*").eq("id", id).maybeSingle(),
  ]);
  if (draft.error || page.error) throw new Error(`Не вдалося завантажити сторінку: ${draft.error?.message ?? page.error?.message}`);
  if (!draft.data && !page.data) return null;
  return {
    document: draft.data ? pageDocumentSchema.parse(draft.data.document) : fromRow(page.data!),
    revision: draft.data?.revision ?? 0,
    published: page.data?.is_published ?? false,
  };
}

export const getPublicPage = cache(async (slug: string) => {
  if (!pageSlug.safeParse(slug).success) return null;
  const { data, error } = await createPublicClient().from("pages").select("*")
    .eq("slug", slug).eq("is_published", true).or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`).maybeSingle();
  if (error) throw new Error(`Не вдалося завантажити сторінку: ${error.message}`);
  return data ? fromRow(data) : null;
});
