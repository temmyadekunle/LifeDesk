import { englishT } from "./risk.ts";
import type { Translate } from "./i18n.ts";
import { daysUntil } from "./risk.ts";
import type { Alert, Thing } from "./types.ts";
import type { Settings } from "./settings.ts";

export type PermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return "denied";
  }
}

/**
 * Which of the user's chosen lead days a given thing has just crossed.
 * Used to produce the PRD's escalating reminder copy:
 * 90 days out, 30 days out, 7 days out.
 */
export function leadDaysCrossed(
  thing: Thing,
  leadDays: number[],
  now: Date = new Date(),
): number[] {
  if (!thing.dueDate) return [];
  const days = daysUntil(thing.dueDate, now);
  return leadDays.filter((lead) => days === lead);
}

export function reminderCopy(
  thing: Thing,
  lead: number,
  tr: Translate = englishT,
): { title: string; body: string } {
  const name = thing.name;

  if (thing.kind === "document") {
    if (lead >= 90)
      return {
        title: tr("reminder.doc.long.title", { name }),
        body: tr("reminder.doc.long.body"),
      };
    if (lead >= 30)
      return {
        title: tr("reminder.doc.month.title", { name }),
        body: tr("reminder.doc.month.body"),
      };
    if (lead > 1)
      return {
        title: tr("reminder.doc.days.title", { name, n: lead }),
        body: tr("reminder.doc.days.body"),
      };
    return {
      title: tr("reminder.doc.tomorrow.title", { name }),
      body: tr("reminder.doc.tomorrow.body"),
    };
  }

  if (thing.kind === "rent") {
    return {
      title: tr.n("reminder.rent.title", lead),
      body: tr("reminder.rent.body"),
    };
  }

  return {
    title: tr.n("reminder.generic.title", lead, { name }),
    body: thing.notes
      ? tr("reminder.generic.body.note", { note: thing.notes })
      : tr("reminder.generic.body.default"),
  };
}

/**
 * Fires a browser notification for the most urgent live alert, at most once
 * per session per alert id.
 */
export function notifyUrgentAlert(
  alert: Alert,
  alreadyNotified: Set<string>,
): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (alreadyNotified.has(alert.id)) return false;

  try {
    new Notification(alert.title, { body: alert.message, tag: alert.id });
    return true;
  } catch {
    return false;
  }
}

export function exportPayload(
  things: Thing[],
  settings: Settings,
): string {
  return JSON.stringify(
    {
      app: "LifeDesk",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      things,
    },
    null,
    2,
  );
}

export function downloadJson(filename: string, payload: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}