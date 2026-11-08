import "server-only";
import { cookies } from "next/headers";
import {
  isThemePreference,
  THEME_COOKIE,
  type ThemePreference,
} from "@/lib/theme";

export async function getThemePreference(): Promise<ThemePreference> {
  const value = (await cookies()).get(THEME_COOKIE)?.value ?? null;
  return isThemePreference(value) ? value : "system";
}
