"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  isThemePreference,
  THEME_COOKIE,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import { useLanguage } from "@/components/layout/language-provider";

const labels: Record<ThemePreference, string> = {
  system: "Система",
  light: "Світла",
  dark: "Темна",
};

const THEME_CHANGE_EVENT = "site-theme-change";

function subscribeToThemeChange(callback: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : "system";
}

function applyTheme(preference: ThemePreference, systemIsDark: boolean) {
  document.documentElement.classList.toggle(
    "dark",
    preference === "dark" || (preference === "system" && systemIsDark),
  );
}

export function ThemeSelector() {
  const { t } = useLanguage();
  const preference = useSyncExternalStore(
    subscribeToThemeChange,
    getThemePreference,
    (): ThemePreference => "system",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme(preference, media.matches);

    if (preference !== "system") return;

    const applySystemTheme = (event: MediaQueryListEvent) =>
      applyTheme("system", event.matches);
    media.addEventListener("change", applySystemTheme);
    return () => media.removeEventListener("change", applySystemTheme);
  }, [preference]);

  const handleChange = (value: string) => {
    if (!isThemePreference(value)) return;

    if (value === "system") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    }
    document.cookie =
      `${THEME_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    applyTheme(value, window.matchMedia("(prefers-color-scheme: dark)").matches);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const Icon =
    preference === "dark" ? Moon : preference === "light" ? Sun : Monitor;

  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">{t("Тема оформлення")}</span>
      <Icon
        className="pointer-events-none absolute left-[11px] size-4 text-muted-foreground sm:left-2"
        aria-hidden="true"
      />
      <select
        aria-label={t("Тема оформлення")}
        value={preference}
        onChange={(event) => handleChange(event.target.value)}
        className="h-10 w-10 appearance-none rounded-md border bg-background pl-8 pr-0 text-xs text-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-28 sm:pr-2 sm:text-foreground"
      >
        {THEME_PREFERENCES.map((option) => (
          <option key={option} value={option} className="bg-background text-foreground">
            {t(labels[option])}
          </option>
        ))}
      </select>
    </label>
  );
}
