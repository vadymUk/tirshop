"use client";

import { Languages } from "lucide-react";
import { LANGUAGES, type Language } from "@/lib/translations";
import { useLanguage } from "@/components/layout/language-provider";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">{t("Мова сайту")}</span>
      <Languages
        className="pointer-events-none absolute left-2 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        aria-label={t("Мова сайту")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        className="h-10 w-[4.5rem] appearance-none rounded-md border bg-background pl-8 pr-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-28 sm:pr-2"
      >
        {LANGUAGES.map((option) => (
          <option key={option} value={option}>
            {option.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
