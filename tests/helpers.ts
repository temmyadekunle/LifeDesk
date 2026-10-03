import assert from "node:assert/strict";
import {
  addFrequency,
  buildAlerts,
  daysUntil,
  derivePriority,
  formatNaira,
} from "../lib/risk.ts";
import type { Alert, Thing } from "../lib/types.ts";

/** Fixed clock so date maths is deterministic. */
export const NOW = new Date("2026-10-03T09:00:00Z");

export function iso(daysFromNow: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/** Builds a fully-populated Thing; override only what a test cares about. */
export function makeThing(overrides: Partial<Thing> = {}): Thing {
  return {
    id: "test-id",
    name: "Test thing",
    category: "money",
    kind: "bill",
    amount: 100,
    currency: "NGN",
    dueDate: null,
    lastHandledDate: null,
    recurrence: null,
    serviceIntervalDays: null,
    status: "active",
    priority: "routine",
    notes: null,
    details: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    thingId: "test-id",
    thingName: "Test thing",
    category: "money",
    kind: "bill",
    priority: "routine",
    reason: "no-record",
    title: "Test alert",
    message: "Test message",
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    dismissed: false,
    ...overrides,
  };
}

export {
  assert,
  addFrequency,
  buildAlerts,
  daysUntil,
  derivePriority,
  formatNaira,
};