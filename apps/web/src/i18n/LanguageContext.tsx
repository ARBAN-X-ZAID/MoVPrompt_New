import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { en, type TranslationKey } from "./translations/en";
import { ar } from "./translations/ar";

export type Locale = "en" | "ar";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const translations: Record<Locale, Record<string, string>> = { en, ar };

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "movprompt-lang";

/**
 * `initialLocale` makes an embedded surface deterministic when its language is
 * already known (for example, a focused test harness). The application omits
 * it and continues to restore the visitor's persisted interface preference.
 */
export const LanguageProvider = ({ children, initialLocale }: { children: ReactNode; initialLocale?: Locale }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale) return initialLocale;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "ar" ? "ar" : "en";
  });

  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: TranslationKey): string => translations[locale][key] || translations.en[key] || key,
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

const fallback: LanguageContextValue = {
  locale: "en",
  setLocale: () => {},
  t: (key: TranslationKey) => translations.en[key] || key,
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  return ctx ?? fallback;
};
