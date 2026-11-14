import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const safeLink = z.string().trim().max(500).refine((value) => {
  if (!value) return true;
  if (/^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Дозволено лише внутрішні шляхи або HTTPS URL");
const imagePath = z.string().max(500).refine((value) => !value || (/^[a-zA-Z0-9_./-]+$/.test(value) && !value.split("/").includes("..")), "Некоректний шлях зображення");
const settings = z.object({
  desktop_image: imagePath.default(""), mobile_image: imagePath.default(""),
  primary_text: text(100).default(""), primary_url: safeLink.default(""),
  secondary_text: text(100).default(""), secondary_url: safeLink.default(""),
  product_ids: z.array(z.string().uuid()).max(24).default([]),
  category_ids: z.array(z.string().uuid()).max(24).default([]),
}).strict();
export const sectionSchema = z.object({
  id: z.string().uuid(), section_key: z.string().regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/).max(100),
  section_type: z.enum(["hero", "promotional", "featured_categories", "featured_products", "benefits", "testimonials", "contact"]),
  title: text(200), subtitle: text(500), content: text(5000), settings,
  sort_order: z.number().int().min(0).max(100000), is_visible: z.boolean(),
}).strict();
const date = z.string().refine((s) => {
  if (!s) return true;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?Z$/.test(s)) return false;
  const parsed = new Date(s);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 16) === s.slice(0, 16);
}, "Некоректна дата UTC");
export const bannerSchema = z.object({
  id: z.string().uuid(), title: text(200).min(1), subtitle: text(500), image_path: imagePath.refine(Boolean, "Вкажіть зображення"),
  mobile_image_path: imagePath, button_text: text(100), button_url: safeLink,
  position: z.enum(["hero", "top", "middle", "bottom"]), sort_order: z.number().int().min(0).max(100000),
  starts_at: date, ends_at: date, is_active: z.boolean(),
}).strict().refine((b) => !b.starts_at || !b.ends_at || Date.parse(b.starts_at) < Date.parse(b.ends_at), { path: ["ends_at"], message: "Дата завершення має бути пізніше початку" });

export const homepagePublicSchema = z.object({
  sections: z.array(sectionSchema).max(50),
  banners: z.array(bannerSchema).max(100),
}).strict();
export const homepageSchema = homepagePublicSchema.superRefine((value, ctx) => {
  if (!value.sections.length) ctx.addIssue({ code: "custom", path: ["sections"], message: "Потрібна хоча б одна секція" });
  for (const [name, values] of [["секцій", value.sections.map((s) => s.id)], ["ключів", value.sections.map((s) => s.section_key)], ["банерів", value.banners.map((b) => b.id)]] as const) {
    if (new Set(values).size !== values.length) ctx.addIssue({ code: "custom", message: `Повторення ${name}` });
  }
});
export type HomepageDocument = z.infer<typeof homepageSchema>;
export type HomeSection = z.infer<typeof sectionSchema>;
export type HomeBanner = z.infer<typeof bannerSchema>;
export const emptySettings = { desktop_image: "", mobile_image: "", primary_text: "", primary_url: "", secondary_text: "", secondary_url: "", product_ids: [], category_ids: [] };
export const sectionLabels: Record<string, string> = {
  hero: "Головний блок", featured_categories: "Популярні категорії", featured_products: "Рекомендовані товари",
  promotional: "Акції та інформаційні блоки", benefits: "Переваги магазину", testimonials: "Відгуки", contact: "Заклик до контакту",
};
