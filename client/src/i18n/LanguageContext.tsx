import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, type Lang, type TranslationDict } from './translations';

interface LanguageContextValue {
  lang:   Lang;
  setLang: (l: Lang) => void;
  t:      TranslationDict;
  isRTL:  boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'wc2026_lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem(STORAGE_KEY) as Lang) || 'en'
  );

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  // Sync <html dir> and <html lang> whenever language changes
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir  = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t:     translations[lang],
    isRTL: lang === 'he',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Hook — use inside any component that needs translations */
export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
