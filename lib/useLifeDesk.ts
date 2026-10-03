"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAlerts,
  daysUntil,
  derivePriority,
  formatNaira,
} from "./risk";
import { getAllThings, putThing } from "./db";
import { seedIfEmpty } from "./seed";
import type { Alert, Category, Thing, ThingKind } from "./types";

export interface NewThingInput {
  name: string;
  category: Category;
  kind: ThingKind;
  amount?: number | null;
  dueDate?: string | null;
  recurrence?: Thing["recurrence"];
  notes?: string | null;
  details?: Record<string, unknown>;
}

export function useLifeDesk() {
  const [things, setThings] = useState<Thing[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const seeded = await seedIfEmpty();
      setThings(seeded);
      setAlerts(buildAlerts(seeded));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the local database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addThing = useCallback(
    async (input: NewThingInput) => {
      const now = new Date().toISOString();
      const thing: Thing = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `id-${Date.now()}`,
        name: input.name,
        category: input.category,
        kind: input.kind,
        amount: input.amount ?? null,
        currency: "NGN",
        dueDate: input.dueDate ?? null,
        lastHandledDate: null,
        recurrence: input.recurrence ?? null,
        serviceIntervalDays: null,
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

  const markHandled = useCallback(
    async (thing: Thing, nextDueDate: string | null) => {
      const updated: Thing = {
        ...thing,
        lastHandledDate: new Date().toISOString().slice(0, 10),
        dueDate: nextDueDate,
        updatedAt: new Date().toISOString(),
      };
      updated.priority = derivePriority(updated);
      await putThing(updated);
      await refresh();
    },
    [refresh],
  );

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
    totals,
    refresh,
    addThing,
    markHandled,
    byCategory,
    formatNaira,
  };
}