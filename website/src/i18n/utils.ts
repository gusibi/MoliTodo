export const locales = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh';

export const localeNames: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
};

export function getStaticPaths() {
  return locales.map((lang) => ({
    params: { lang },
    props: { lang },
  }));
}

export async function useTranslations(lang: Locale) {
  const modules = import.meta.glob<{ default: Record<string, unknown> }>('./ui/*.json');
  const key = `./ui/${lang}.json`;
  const mod = modules[key] ? await modules[key]() : null;
  const fallback = modules[`./ui/${defaultLocale}.json`]
    ? await modules[`./ui/${defaultLocale}.json`]()
    : null;

  const ui = mod?.default ?? fallback?.default ?? {};

  function t(key: string): string {
    const result = key.split('.').reduce<unknown>((obj, k) => {
      if (obj && typeof obj === 'object' && k in obj) {
        return (obj as Record<string, unknown>)[k];
      }
      return undefined;
    }, ui);
    return typeof result === 'string' ? result : key;
  }

  return { t, ui };
}
