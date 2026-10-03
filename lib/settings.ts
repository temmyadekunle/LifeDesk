import { getSetting, putSetting } from "./db.ts";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./i18n.ts";
import type { Category } from "./types.ts";

export interface Settings {
  onboarded: boolean;
  displayName: string;
  /** UI language. */
  locale: Locale;
  /** Low-data mode: suppress anything that would upload or download. */
  dataSaver: boolean;
  /** Fire a browser notification when urgent alerts exist. */
  notifyUrgent: boolean;
  /** Days ahead of the due date that a reminder should appear. */
  leadDays: number[];
  /** Which areas the user said they want to manage during onboarding. */
  managedCategories: Category[];
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  displayName: "",
  locale: DEFAULT_LOCALE,
  dataSaver: true,
  notifyUrgent: true,
  leadDays: [90, 30, 7],
  managedCategories: [],
};

const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await getSetting<Partial<Settings>>(KEY);
    const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    if (!isLocale(merged.locale)) merged.locale = DEFAULT_LOCALE;
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await putSetting(KEY, settings);
}