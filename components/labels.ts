import type { Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import { daysUntil } from "@/lib/risk";
import type { Alert, Thing } from "@/lib/types";

export type Tone = "urgent" | "warn" | "info" | "ok" | "neutral";

export const TONE_CLASS: Record<Tone, string> = {
  urgent: "b-urgent",
  warn: "b-important",
  info: "b-upcoming",
  ok: "b-routine",
  neutral: "b-done",
};

/**
 * The one place that decides how a due date reads. Several screens show the
 * same responsibility, and a card that said "Overdue by 2 days" next to a row
 * that said "Due in 2 days" for the same item would undermine trust in the
 * whole app.
 */
export function dueMeta(
  thing: Thing,
  t: Translate,
  now: Date = new Date(),
): { text: string; tone: Tone } {
  if (thing.status === "completed") {
    return { text: t("row.completed"), tone: "ok" };
  }
  if (!thing.dueDate) {
    return { text: thing.notes ?? t("row.noDate"), tone: "neutral" };
  }

  const days = daysUntil(thing.dueDate, now);

  if (days < 0) {
    return {
      text: t.n("row.overdue", Math.abs(days)),
      tone: "urgent",
    };
  }
  if (days === 0) return { text: t("ui.dueToday"), tone: "urgent" };
  if (days === 1) return { text: t("ui.dueTomorrow"), tone: "warn" };
  if (days <= 7) return { text: t.n("row.dueIn", days), tone: "warn" };
  if (days <= 30) return { text: t.n("row.dueIn", days), tone: "info" };
  return { text: t.n("row.dueIn", days), tone: "neutral" };
}

export function alertTone(alert: Alert): Tone {
  if (alert.priority === "urgent") return "urgent";
  if (alert.priority === "important") return "warn";
  if (alert.priority === "upcoming") return "info";
  return "neutral";
}

export function priorityTone(thing: Thing): Tone {
  if (thing.status === "completed") return "ok";
  switch (thing.priority) {
    case "urgent":
      return "urgent";
    case "important":
      return "warn";
    case "upcoming":
      return "info";
    default:
      return "neutral";
  }
}

export function kindLabelKey(thing: Thing): TKey {
  return `kind.${thing.kind}` as TKey;
}

/** First letter for the avatar, tolerant of empty and multi-word names. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}