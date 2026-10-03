"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAlerts, daysUntil, derivePriority, formatNaira } from "./risk";
import { computeLifeStatus } from "./status";
import { deleteAlert, getAllThings, putAlert, putThing } from "./db";
import { seedIfEmpty } from "./seed";
import type { Alert, Category, Thing, ThingKind } from "./types";

export interface NewThingInput {
  name: string;
  category: Category;
  kind: ThingKind;
  amount?: number | null;
  dueDate?: string | null;
  recurrence?: Thing["recurrence"];
  serviceIntervalDays?: number | null;
  notes?: string | null;
  details?: Record<string, unknown>;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useLifeDesk() {
  const [things, setThings] = useState<Thing[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const seeded = await seedIfEmpty();
      setThings(seeded);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open the local database.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const alerts = useMemo(() => {
    const built = buildAlerts(things);
    return built.filter((a) => !dismissedIds.has(a.id));
  }, [things, dismissedIds]);

  const status = useMemo(
    () => computeLifeStatus(things, alerts),
    [things, alerts],
  );

  const addThing = useCallback(
    async (input: NewThingInput) => {
      const now = new Date().toISOString();
      const thing: Thing = {
        id: makeId(),
        name: input.name,
        category: input.category,
        kind: input.kind,
        amount: input.amount ?? null,
        currency: "NGN",
        dueDate: input.dueDate ?? null,
        lastHandledDate: null,
        recurrence: input.recurrence ?? null,
        serviceIntervalDays: input.serviceIntervalDays ?? null,
        status: "active",
        priority: "routine",
        notes: input.notes ?? null,
        details: input.details ?? {},
        createdAt: now,
        updatedAt: now,
      };
      thing.priority = derivePriority(thing);
      await putThing(thing);
      await refresh();
      return thing;
    },
    [refresh],
  );

  /**
   * Records that a responsibility was handled. A recurring thing rolls forward
   * to its next due date; a one-off thing is marked completed.
   */
  const completeThing = useCallback(
    async (thing: Thing) => {
      const today = new Date().toISOString().slice(0, 10);
      const updated: Thing = {
        ...thing,
        lastHandledDate: today,
        status: thing.recurrence ? "active" : "completed",
        dueDate: thing.recurrence
          ? rollForward(today, thing.recurrence.frequency, thing.recurrence.interval)
          : thing.dueDate,
        updatedAt: new Date().toISOString(),
      };
      updated.priority = derivePriority(updated);
      await putThing(updated);
      await refresh();
    },
    [refresh],
  );

  const dismissAlert = useCallback(
    async (alert: Alert) => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(alert.id);
        return next;
      });
      const stored: Alert = { ...alert, dismissed: true };
      try {
        await putAlert(stored);
      } catch {
        await deleteAlert(alert.id).catch(() => undefined);
      }
    },
    [],
  );

  const restoreAlerts = useCallback(() => {
    setDismissedIds(new Set());
  }, []);

  const byCategory = useCallback(
    (category: Category) => things.filter((t) => t.category === category),
    [things],
  );

  const totals = useMemo(() => {
    const HORIZON = 30;
    const upcoming = things.filter((t) => {
      if (t.status !== "active" || !t.dueDate) return false;
      const d = daysUntil(t.dueDate);
      return d >= 0 && d <= HORIZON;
    });
    return {
      total: upcoming.reduce((sum, t) => sum + (t.amount ?? 0), 0),
      count: upcoming.length,
      items: upcoming.sort((a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
      ),
    };
  }, [things]);

  return {
    loading,
    error,
    things,
    alerts,
    status,
    totals,
    refresh,
    addThing,
    completeThing,
    dismissAlert,
    restoreAlerts,
    byCategory,
    formatNaira,
  };
}

const STEP_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  biannual: 182,
  annual: 365,
};

function rollForward(
  from: string,
  frequency: string,
  interval = 1,
): string | null {
  const days = STEP_DAYS[frequency];
  if (!days) return null;
  const date = new Date(`${from}T00:00:00`);
  date.setDate(date.getDate() + days * Math.max(1, interval));
  return date.toISOString().slice(0, 10);
}