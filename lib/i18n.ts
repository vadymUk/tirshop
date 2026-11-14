import "server-only";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, LANGUAGES, type Language } from "@/lib/translations";
import { getPublicSettings } from "@/lib/settings/public";

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  if (LANGUAGES.includes(value as Language)) return value as Language;
  const { default_language } = await getPublicSettings();
  const baseLanguage = default_language.split("-")[0];
  if (baseLanguage === "uk") return "ua";
  if (baseLanguage === "ru" || baseLanguage === "pl") return baseLanguage;
  console.error(`Непідтримувана мова магазину: ${default_language}`);
  return "ua";
}
