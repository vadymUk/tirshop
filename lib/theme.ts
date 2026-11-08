export const THEME_STORAGE_KEY = "site-theme";
export const THEME_COOKIE = "site-theme";

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: string | null): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}
