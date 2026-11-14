import { z } from "zod";
import { safeLink } from "@/lib/homepage/schema";
import { publicEnv } from "@/lib/env";

export const pageSlug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const path = z.string().max(500).refine((value) => !value || (/^[a-zA-Z0-9_./-]+$/.test(value) && !value.split("/").includes("..")), "Некоректний шлях зображення");
const sitePrefix = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-media/`;
export function validImageUrl(src: string) {
  if (!src.startsWith(sitePrefix)) return false;
  const suffix = src.slice(sitePrefix.length);
  return path.safeParse(suffix).success && Boolean(suffix);
}

export type RichNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: RichNode[] };
const allowed: Record<string, readonly string[]> = {
  doc: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image", "table"],
  paragraph: ["text", "hardBreak"], heading: ["text", "hardBreak"],
  bulletList: ["listItem"], orderedList: ["listItem"], listItem: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image", "table"],
  blockquote: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image", "table"],
  table: ["tableRow"], tableRow: ["tableCell", "tableHeader"], tableCell: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image"], tableHeader: ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "image"],
  text: [], hardBreak: [], image: [],
};
const rawNode = z.object({ type: z.string(), text: z.string().optional(), attrs: z.record(z.unknown()).nullable().optional(),
  marks: z.array(z.object({ type: z.string(), attrs: z.record(z.unknown()).nullable().optional() }).strict()).max(4).optional(),
  content: z.array(z.unknown()).optional() }).strict();
export function parseRichContent(input: unknown): RichNode {
  let count = 0;
  let textLength = 0;
  function parse(value: unknown, parent: string | null, depth: number): RichNode {
    if (++count > 3000 || depth > 12) throw new Error("Документ занадто великий або вкладений");
    const node = rawNode.parse(value);
    if (!(node.type in allowed) || (parent ? !allowed[parent].includes(node.type) : node.type !== "doc")) throw new Error("Непідтримуваний елемент документа");
    if (node.type === "text") {
      if (!node.text) throw new Error("Порожній текстовий елемент");
      textLength += node.text.length;
      if (textLength > 100000) throw new Error("Текст занадто довгий");
    } else if (node.text !== undefined || node.marks?.length) throw new Error("Некоректний елемент документа");
    if (node.type === "heading" && ![2, 3, 4].includes(Number(node.attrs?.level))) throw new Error("Недопустимий рівень заголовка");
    if (node.type === "image" && (typeof node.attrs?.src !== "string" || !validImageUrl(node.attrs.src) || typeof (node.attrs.alt ?? "") !== "string")) throw new Error("Дозволено лише зображення з медіатеки сайту");
    if (node.type === "tableCell" || node.type === "tableHeader") {
      if ((node.attrs?.colspan ?? 1) !== 1 || (node.attrs?.rowspan ?? 1) !== 1) throw new Error("Об’єднані комірки не підтримуються");
    }
    for (const mark of node.marks ?? []) {
      if (!["bold", "italic", "link"].includes(mark.type)) throw new Error("Непідтримуване форматування");
      if (mark.type === "link" && (typeof mark.attrs?.href !== "string" || !mark.attrs.href || !safeLink.safeParse(mark.attrs.href).success)) throw new Error("Небезпечне посилання");
    }
    const children = node.content?.map((child) => parse(child, node.type, depth + 1));
    if (!allowed[node.type].length && children?.length) throw new Error("Некоректна структура документа");
    return { ...node, attrs: node.attrs ?? undefined, marks: node.marks?.map((mark) => ({ ...mark, attrs: mark.attrs ?? undefined })), content: children };
  }
  return parse(input, null, 0);
}

const richContent = z.unknown().transform((value, ctx) => {
  try { return parseRichContent(value); }
  catch (error) { ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Некоректний документ" }); return z.NEVER; }
});
export const pageDocumentSchema = z.object({
  slug: pageSlug, title: z.string().trim().min(1).max(200), excerpt: z.string().trim().max(500),
  content: richContent, featured_image_path: path, meta_title: z.string().trim().max(200),
  meta_description: z.string().trim().max(500), canonical_url: safeLink, og_image_path: path,
  published_at: z.string().refine((value) => !value || /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19), "Некоректна дата UTC"),
}).strict();
export type PageDocument = z.infer<typeof pageDocumentSchema>;
export const emptyPage = { slug: "", title: "", excerpt: "", content: { type: "doc", content: [{ type: "paragraph" }] },
  featured_image_path: "", meta_title: "", meta_description: "", canonical_url: "", og_image_path: "", published_at: "" };
export const fixedSlugs = ["about", "contact", "shipping", "returns", "privacy", "terms"] as const;
export function pageHref(slug: string) { return (fixedSlugs as readonly string[]).includes(slug) ? `/${slug}` : `/pages/${slug}`; }
