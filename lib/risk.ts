import { makeT, type Translate } from "./i18n.ts";
import type { Alert, Frequency, Priority, Thing } from "./types.ts";

const MS_PER_DAY = 86_400_000;

/** Default translator, so callers that do not care about locale get English. */
export const englishT: Translate = makeT("en");

/** Whole days from today until `iso`. Negative when already past. */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(`${iso}T00:00:00`);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY);
}

export function addFrequency(
  iso: string,
  frequency: Frequency,
  interval = 1,
): string | null {
  if (frequency === "none") return null;
  const date = new Date(`${iso}T00:00:00`);
  const steps: Record<Exclude<Frequency, "none">, number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
    biannual: 182,
    annual: 365,
  };
  date.setDate(date.getDate() + steps[frequency] * Math.max(1, interval));
  return date.toISOString().slice(0, 10);
}

/**
 * Phase 1 version: rules only. The Phase 2 engine adds historical-pattern
 * signals such as unusually high electricity spend.
 */
export function derivePriority(thing: Thing, now: Date = new Date()): Priority {
  if (thing.status !== "active") return "routine";
  if (thing.lastHandledDate) return "routine";

  if (thing.dueDate) {
    const days = daysUntil(thing.dueDate, now);
    if (days < 0) return "urgent";
    if (days <= 7) return "urgent";
    if (days <= 30) return "important";
    if (days <= 90) return "upcoming";
    return "routine";
  }

  if (thing.serviceIntervalDays && thing.lastHandledDate === null) {
    return "important";
  }

  return "routine";
}

export { formatNaira } from "./i18n.ts";

const REASONS: Record<
  Alert["reason"],
  (t: Thing, days: number | null, tr: Translate) => {
    title: string;
    message: string;
  }
> = {
  overdue: (t, d, tr) => ({
    title: tr("alert.overdue.title", { name: t.name }),
    message:
      d === null
        ? tr("alert.overdue.message.none")
        : d === 1
          ? tr("alert.overdue.message.days_one", { n: 1 })
          : tr("alert.overdue.message.days_many", { n: Math.abs(d) }),
  }),
  expiring: (t, d, tr) => ({
    title:
      d === 1
        ? tr("alert.expiring.title_one", { name: t.name, n: 1 })
        : tr("alert.expiring.title_many", { name: t.name, n: d ?? 0 }),
    message:
      d !== null && d <= 30
        ? tr("alert.expiring.message.soon")
        : tr("alert.expiring.message.later"),
  }),
  "recurring-due": (t, d, tr) => ({
    title:
      d === 1
        ? tr("alert.recurring.title_one", { name: t.name, n: 1 })
        : tr("alert.recurring.title_many", { name: t.name, n: d ?? 0 }),
    message: tr("alert.recurring.message"),
  }),
  "service-overdue": (t, _d, tr) => ({
    title: tr("alert.service.title", { name: t.name }),
    message: tr("alert.service.message"),
  }),
  "no-record": (t, _d, tr) => ({
    title: tr("alert.norecord.title", { name: t.name }),
    message: tr("alert.norecord.message"),
  }),
};

export function buildAlerts(
  things: Thing[],
  now: Date = new Date(),
  tr: Translate = englishT,
): Alert[] {
  const alerts: Alert[] = [];

  for (const thing of things) {
    if (thing.status !== "active") continue;

    const priority = derivePriority(thing, now);
    const days = thing.dueDate ? daysUntil(thing.dueDate, now) : null;

    let reason: Alert["reason"] | null = null;

    if (days !== null && days < 0) reason = "overdue";
    else if (days !== null && days <= 30 && thing.kind === "document")
      reason = "expiring";
    else if (days !== null && days <= 30 && thing.recurrence)
      reason = "recurring-due";
    else if (
      thing.serviceIntervalDays &&
      thing.kind === "maintenance" &&
      days === null
    )
      reason = "service-overdue";
    else if (!thing.dueDate && !thing.serviceIntervalDays) reason = "no-record";

    if (!reason) continue;

    const { title, message } = REASONS[reason](thing, days, tr);
    alerts.push({
      id: `${thing.id}:${reason}`,
      thingId: thing.id,
      thingName: thing.name,
      category: thing.category,
      kind: thing.kind,
      priority,
      reason,
      title,
      message,
      dueDate: thing.dueDate,
      createdAt: now.toISOString(),
      dismissed: false,
    });
  }

  const order: Record<Priority, number> = {
    urgent: 0,
    important: 1,
    upcoming: 2,
    routine: 3,
  };

  return alerts.sort((a, b) => order[a.priority] - order[b.priority]);
}