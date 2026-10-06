/**
 * Date helpers for the calendar and agenda.
 *
 * Due dates in Livanta are plain calendar days (`YYYY-MM-DD`), not instants.
 * Everything here therefore works in local midnight and avoids `new Date(iso)`,
 * which would parse the string as UTC and shift the day for anyone west of
 * Greenwich — including Lagos (UTC+1), where a due date would appear a day early.
 */

import type { Locale } from "./i18n.ts";

/**
 * Which part of the day it is, for greetings.
 *
 * Unlike everything else in this file, this deliberately reads the *reader's*
 * local clock. A due date is a calendar day that means the same thing in Lagos
 * and in London, so it is pinned to local midnight to keep the day stable. "Good
 * evening" is not that: it is a statement about the hour where the reader
 * actually is, and a Londoner reading this at 21:00 should be greeted in their
 * own evening, not in Lagos's afternoon.
 *
 * The three windows cover all 24 hours with no gap and no overlap. The small
 * hours are evening rather than morning, because "Good morning" at 02:00 reads
 * as though the app has the wrong idea of the time.
 */
export type DayPart = "morning" | "afternoon" | "evening";

export function dayPart(date: Date): DayPart {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISO(a) === toISO(b);
}

export function isToday(date: Date, now: Date = new Date()): boolean {
  return isSameDay(date, now);
}

/**
 * A 6x7 grid covering the month, Monday first. Always 42 cells so the grid
 * height never jumps between months.
 */
export function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** Weekday initials, Monday first, in the reader's chosen language. */
export function weekdayInitials(locale: Locale): string[] {
  const tag = locale === "en" ? "en-GB" : locale;
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((fallback) => {
    try {
      return new Intl.DateTimeFormat(tag, { weekday: "narrow" }).format(
        new Date(2024, 0, 1 + names.indexOf(fallback)),
      );
    } catch {
      return fallback.slice(0, 1);
    }
  });
}

export function formatMonthYear(date: Date, locale: Locale): string {
  const tag = locale === "en" ? "en-GB" : locale;
  try {
    return new Intl.DateTimeFormat(tag, {
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return `${date.toLocaleString("en-GB", { month: "long" })} ${date.getFullYear()}`;
  }
}

export function formatDayMonth(iso: string, locale: Locale): string {
  return formatDate(parseISO(iso), locale, { day: "numeric", month: "short" });
}

export function formatFullDate(iso: string, locale: Locale): string {
  return formatDate(parseISO(iso), locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDate(
  date: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): string {
  const tag = locale === "en" ? "en-GB" : locale;
  try {
    return new Intl.DateTimeFormat(tag, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(date);
  }
}