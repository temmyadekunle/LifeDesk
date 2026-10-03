import { en, type Dict, type PluralBase, type TKey } from "./locales/en.ts";
import { ha } from "./locales/ha.ts";
import { ig } from "./locales/ig.ts";
import { yo } from "./locales/yo.ts";

export type Locale = "en" | "ha" | "yo" | "ig";

export const LOCALES: readonly Locale[] = ["en", "ha", "yo", "ig"] as const;

/** Endonyms — each language names itself, which is the convention. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: en["lang.en"],
  ha: en["lang.ha"],
  yo: en["lang.yo"],
  ig: en["lang.ig"],
};

export const DICTIONARIES: Record<Locale, Dict> = { en, ha, yo, ig };

export const DEFAULT_LOCALE: Locale = "en";

export type TranslateParams = Record<string, string | number>;

export interface Translate {
  (key: TKey, params?: TranslateParams): string;
  /** Resolves a `_one` / `_many` pair using English-style singular/plural. */
  n(base: PluralBase, count: number, params?: TranslateParams): string;
  locale: Locale;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

export function makeT(locale: Locale): Translate {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

  const t = ((key: TKey, params?: TranslateParams) =>
    interpolate(dict[key] ?? en[key] ?? key, params)) as Translate;

  t.locale = locale;
  t.n = (base: PluralBase, count: number, params?: TranslateParams) => {
    const key = `${base}_${count === 1 ? "one" : "many"}` as TKey;
    return t(key, { ...params, n: count });
  };

  return t;
}

/** Formats naira for display; deliberately not localised, since ₦ is universal. */
export function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString("en-NG")}`;
}