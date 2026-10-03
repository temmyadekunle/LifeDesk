import type { Alert, Frequency, Priority, Thing } from "./types.ts";

const MS_PER_DAY = 86_400_000;

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

export function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString("en-NG")}`;
}

const REASONS: Record<
  Alert["reason"],
  (t: Thing, days: number | null) => { title: string; message: string }
> = {
  overdue: (t, d) => ({
    title: `${t.name} is overdue`,
    message:
      d === null
        ? "This responsibility has passed its due date."
        : `This responsibility was due ${Math.abs(d)} day${
            Math.abs(d) === 1 ? "" : "s"
          } ago.`,
  }),
  expiring: (t, d) => ({
    title: `${t.name} expires in ${d} day${d === 1 ? "" : "s"}`,
    message:
      d !== null && d <= 30
        ? "Start preparing now to avoid penalties or inconvenience."
        : "No action needed yet, but it is coming up.",
  }),
  "recurring-due": (t, d) => ({
    title: `${t.name} renews in ${d ?? 0} day${d === 1 ? "" : "s"}`,
    message: "A recurring payment is approaching.",
  }),
  "service-overdue": (t) => ({
    title: `${t.name} service is overdue`,
    message:
      "Delaying routine maintenance may increase the likelihood of unexpected repair costs.",
  }),
  "no-record": (t) => ({
    title: `${t.name} has no record yet`,
    message: "Add a date so LifeDesk can watch it for you.",
  }),
};

export function buildAlerts(things: Thing[], now: Date = new Date()): Alert[] {
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

    const { title, message } = REASONS[reason](thing, days);
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