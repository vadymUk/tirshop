"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGE_COOKIE, type Language, translate } from "@/lib/translations";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState(initialLanguage);
  const router = useRouter();

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next === "ua" ? "uk" : next;
    router.refresh();
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: (source) => translate(language, source) }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:p-2"
      >
        {translate(language, "Перейти до вмісту")}
      </a>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
