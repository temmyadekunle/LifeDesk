/**
 * Conversions between the local app model and the cloud rows.
 *
 * Pure on purpose: the conflict rules in sync/merge.ts depend on these being
 * exactly reversible, and the offline guarantee is far easier to trust when
 * the shape mapping can be tested without a network.
 */

import type { Settings } from "../settings.ts";
import type { Category, Thing } from "../types.ts";
import type {
  Json,
  JsonArray,
  JsonObject,
  SettingsRow,
  ThingRow,
} from "../supabase/types.ts";

export function thingToRow(thing: Thing, userId: string): ThingRow {
  return {
    id: thing.id,
    user_id: userId,
    name: thing.name,
    category: thing.category,
    kind: thing.kind,
    amount: thing.amount,
    currency: thing.currency,
    due_date: thing.dueDate,
    last_handled_date: thing.lastHandledDate,
    recurrence: thing.recurrence as unknown as Json,
    service_interval_days: thing.serviceIntervalDays,
    status: thing.status,
    priority: thing.priority,
    notes: thing.notes,
    details: thing.details as unknown as JsonObject,
    created_at: thing.createdAt,
    updated_at: thing.updatedAt,
    deleted_at: null,
  };
}

/**
 * The shape upsert_things_sync expects: a row without user_id, because the SQL
 * fills that in from the request JWT so a client cannot write rows into someone
 * else's account.
 */
export function thingToSyncPayload(thing: Thing): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...thingToRow(thing, "") };
  delete payload.user_id;
  return payload;
}

/**
 * Rebuild a Thing from a row, or null for a tombstone. A deleted row becoming
 * null is what lets the pull apply deletions rather than re-inserting records
 * another device removed.
 */
export function rowToThing(row: ThingRow): Thing | null {
  if (row.deleted_at) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    kind: row.kind as Thing["kind"],
    amount: row.amount === null ? null : Number(row.amount),
    currency: "NGN",
    dueDate: row.due_date,
    lastHandledDate: row.last_handled_date,
    recurrence: (row.recurrence ?? null) as Thing["recurrence"],
    serviceIntervalDays: row.service_interval_days,
    status: row.status as Thing["status"],
    priority: row.priority as Thing["priority"],
    notes: row.notes,
    details: (row.details ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function settingsToRow(
  settings: Settings,
  userId: string,
  updatedAt: string,
): SettingsRow {
  return {
    user_id: userId,
      onboarded: settings.onboarded,
      display_name: settings.displayName,
      // "" rather than null when unset: one representation is easier to reason
      // about than "sometimes empty string, sometimes null".
      avatar: settings.avatar || null,
    locale: settings.locale,
    data_saver: settings.dataSaver,
    notify_urgent: settings.notifyUrgent,
    lead_days: settings.leadDays as unknown as JsonArray,
    managed_categories: settings.managedCategories as unknown as JsonArray,
    updated_at: updatedAt,
  };
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
      onboarded: row.onboarded,
      displayName: row.display_name,
      avatar: row.avatar ?? "",
    locale: row.locale as Settings["locale"],
    dataSaver: row.data_saver,
    notifyUrgent: row.notify_urgent,
    leadDays: (row.lead_days ?? []) as number[],
    managedCategories: (row.managed_categories ?? []) as Category[],
  };
}