import "server-only";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, LANGUAGES, type Language } from "@/lib/translations";

export async function getLanguage(): Promise<Language> {
  const value = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  return LANGUAGES.includes(value as Language) ? (value as Language) : "ua";
}
