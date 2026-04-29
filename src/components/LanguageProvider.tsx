'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Locale, TranslationKey, detectLocale, translate } from '@/lib/i18n';

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<Ctx>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = (typeof window !== 'undefined' && (localStorage.getItem('locale') as Locale | null)) || null;
    const initial = stored ?? detectLocale();
    setLocaleState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
