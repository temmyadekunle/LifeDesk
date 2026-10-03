import type { Alert, Thing } from "./types.ts";
import { daysUntil } from "./risk.ts";

export type LifeLevel = "stable" | "needs-attention" | "immediate";

export interface LifeStatus {
  level: LifeLevel;
  label: string;
  headline: string;
  urgentCount: number;
  importantCount: number;
  upcomingCount: number;
  onTrackCount: number;
  thisWeekCount: number;
}

/**
 * Mirrors the PRD's "Life Desk Status": Stable, Needs Attention, or
 * Immediate Attention, derived from unresolved responsibilities.
 */
export function computeLifeStatus(
  things: Thing[],
  alerts: Alert[],
  now: Date = new Date(),
): LifeStatus {
  const active = things.filter((t) => t.status === "active");
  const live = alerts.filter((a) => !a.dismissed);

  const urgentCount = live.filter((a) => a.priority === "urgent").length;
  const importantCount = live.filter((a) => a.priority === "important").length;
  const upcomingCount = live.filter((a) => a.priority === "upcoming").length;

  const thisWeekCount = active.filter((t) => {
    if (!t.dueDate) return false;
    const d = daysUntil(t.dueDate, now);
    return d >= 0 && d <= 7;
  }).length;

  const onTrackCount = active.filter((t) => {
    if (t.priority === "urgent" || t.priority === "important") return false;
    const d = t.dueDate ? daysUntil(t.dueDate, now) : null;
    if (d !== null && d <= 7) return false;
    return true;
  }).length;

  let level: LifeLevel;
  let label: string;
  let headline: string;

  if (urgentCount === 0 && importantCount === 0) {
    level = "stable";
    label = "Stable";
    headline = "You're mostly on track.";
  } else if (urgentCount === 0) {
    level = "needs-attention";
    label = "Needs attention";
    headline = `${importantCount} thing${
      importantCount === 1 ? "" : "s"
    } should be handled soon.`;
  } else {
    level = "immediate";
    label = "Immediate attention";
    headline = `${urgentCount} thing${urgentCount === 1 ? "" : "s"} need${
      urgentCount === 1 ? "s" : ""
    } attention now.`;
  }

  return {
    level,
    label,
    headline,
    urgentCount,
    importantCount,
    upcomingCount,
    onTrackCount,
    thisWeekCount,
  };
}