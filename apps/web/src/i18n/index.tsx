import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { id, type MessageKey } from './id';

export type Lang = 'id' | 'en';
const messages: Record<Lang, Record<MessageKey, string>> = { id, en };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
  /** Rupiah, e.g. "Rp185.000.000". Engine values are already rounded (rule 4). */
  rp: (amount: number) => string;
  pct: (fraction: number, digits?: number) => string;
  date: (iso: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ initialLang = 'id', children }: { initialLang?: Lang; children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const value = useMemo<I18n>(() => {
    const locale = lang === 'id' ? 'id-ID' : 'en-ID';
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
    const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    return {
      lang,
      setLang,
      t: (key, vars) =>
        messages[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => (vars && name in vars ? String(vars[name]) : m)),
      rp: (amount) => money.format(amount),
      pct: (fraction, digits = 0) =>
        new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(fraction),
      date: (iso) => dateFmt.format(new Date(`${iso}T00:00:00Z`)),
    };
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
