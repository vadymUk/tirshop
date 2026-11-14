import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { seoImagePath } from "@/lib/admin/media-shared";
import { settingsSchemas } from "@/lib/admin/settings-validation";
import { sellerContacts } from "@/config/site";

export const getPublicSettings = cache(async () => {
  const { data, error } = await createPublicClient().from("site_settings")
    .select("store_name,store_description,logo_path,favicon_path,contact_email,contact_phone,whatsapp_number,viber_number,telegram_username,business_address,company_name,nip,regon,vat_details,return_address,currency,default_language,timezone,facebook_url,instagram_url,tiktok_url,youtube_url,announcement_text,announcement_enabled")
    .limit(1).maybeSingle();
  if (error || !data) throw new Error(`Не вдалося завантажити публічні налаштування: ${error?.message ?? "запис відсутній"}`);
  for (const path of [data.logo_path, data.favicon_path]) {
    if (path && !seoImagePath.safeParse(path).success) throw new Error("Некоректний шлях зображення налаштувань магазину.");
  }
  const social = settingsSchemas.social.parse({
    facebook_url: data.facebook_url ?? "", instagram_url: data.instagram_url ?? "",
    tiktok_url: data.tiktok_url ?? "", youtube_url: data.youtube_url ?? "",
  });
  const contact = settingsSchemas.contact.parse({
    contact_email: data.contact_email ?? "",
    contact_phone: data.contact_phone ?? sellerContacts.phoneDisplay,
    whatsapp_number: data.whatsapp_number ?? sellerContacts.phone,
    viber_number: data.viber_number ?? sellerContacts.phone,
    telegram_username: data.telegram_username ?? "",
    business_address: data.business_address ?? "",
  });
  return { ...data, ...contact, ...social, legacyTelegram: data.telegram_username === null };
});

export function contactLinks(settings: Awaited<ReturnType<typeof getPublicSettings>>) {
  const digits = (value: string) => value.replace(/\D/g, "");
  const tel = (value: string) => `${value.startsWith("+") ? "+" : ""}${digits(value)}`;
  return {
    phone: settings.contact_phone ? `tel:${tel(settings.contact_phone)}` : "",
    whatsapp: settings.whatsapp_number ? `https://wa.me/${digits(settings.whatsapp_number)}` : "",
    viber: settings.viber_number ? `viber://chat?number=${encodeURIComponent(tel(settings.viber_number))}` : "",
    telegram: settings.telegram_username ? `https://t.me/${settings.telegram_username}` : settings.legacyTelegram ? sellerContacts.links.telegram : "",
  };
}
