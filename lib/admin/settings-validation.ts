import { z } from "zod";
import { seoImagePath } from "@/lib/admin/media-shared";

const text = (max: number) => z.string().trim().max(max);
const email = z.union([z.literal(""), z.string().trim().email().max(254)]);
const phone = text(30).refine((value) => !value || /^\+?[0-9 ()-]+$/.test(value) && value.replace(/\D/g, "").length >= 6, "Некоректний номер");
const internationalPhone = phone.refine((value) => !value || /^\+/.test(value), "Вкажіть міжнародний номер із +");
const image = z.union([z.literal(""), seoImagePath]);
const url = text(500).refine((value) => {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Потрібна безпечна HTTPS-адреса");
const timezone = text(100).refine((value) => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Некоректний часовий пояс");

export const settingsSchemas = {
  general: z.object({
    store_name: text(200).min(1), store_description: text(2000),
    default_language: z.enum(["uk", "ru", "pl"]), currency: z.string().regex(/^[A-Z]{3}$/), timezone,
  }).strict(),
  contact: z.object({
    contact_email: email, contact_phone: phone, whatsapp_number: internationalPhone, viber_number: internationalPhone,
    telegram_username: text(32).refine((value) => !value || /^[A-Za-z0-9_]{5,32}$/.test(value), "Некоректне ім’я Telegram"),
    business_address: text(500),
  }).strict(),
  social: z.object({ facebook_url: url, instagram_url: url, tiktok_url: url, youtube_url: url }).strict(),
  appearance: z.object({
    logo_path: image, favicon_path: image, announcement_text: text(500), announcement_enabled: z.boolean(),
  }).strict().refine((value) => !value.announcement_enabled || Boolean(value.announcement_text), {
    path: ["announcement_text"], message: "Вкажіть текст оголошення",
  }),
  behavior: z.object({ low_stock_threshold: z.string().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().int().min(0).max(1_000_000)) }).strict(),
  notifications: z.object({ seller_notification_email: email, customer_email_notifications: z.boolean(), order_status_notifications: z.boolean() }).strict(),
  legal: z.object({ company_name: text(200), business_address: text(500), nip: text(100), regon: text(100), vat_details: text(500), return_address: text(500) }).strict(),
};

export const settingsSection = z.enum(["general", "contact", "social", "appearance", "behavior", "notifications", "legal"]);
export type SettingsSection = z.infer<typeof settingsSection>;
