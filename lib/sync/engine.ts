/**
 * The sync engine: pull remote changes, then push local ones.
 *
 * Deliberately boring and pull-based. Realtime is left out because a household
 * app that reconnects on every backgrounded tab is a support burden, and
 * syncing on focus, on mutation and on demand is enough for the handful of
 * devices a household actually uses.
 *
 * Pull happens *before* push deliberately. After the merge, local state holds
 * the newest version of every record, so anything still newer than the cursor
 * is a genuine local edit; anything the remote won is re-sent unchanged, which
 * is harmless. The stricter guard lives in the SQL function, because this table
 * is the only copy of a user's data.
 *
 * Every call is guarded so that a failure, an offline device or a missing
 * configuration leaves IndexedDB exactly as it was. Sync is never a
 * precondition for using the app.
 */

import { deleteThing, getAllAlerts, getAllThings, putAlert, putThing } from "../db.ts";
import { loadSettings, saveSettings } from "../settings.ts";
import type { Thing } from "../types.ts";
import { getSupabase, type Supabase } from "../supabase/client.ts";
import type { DismissalRow, Json, SettingsRow, ThingRow } from "../supabase/types.ts";
import {
  mergeDismissals,
  mergeThings,
  shouldAcceptRemoteSettings,
  ts,
} from "./merge.ts";
import { readSyncMeta, writeSyncMeta, type SyncMeta } from "./meta.ts";
import { rowToSettings, settingsToRow, thingToSyncPayload } from "./rows.ts";

export type SyncPhase = "idle" | "syncing" | "done" | "error";

export interface SyncResult {
  pushed: number;
  pulled: number;
  removed: number;
  at: string;
}

const NOOP: SyncResult = { pushed: 0, pulled: 0, removed: 0, at: "" };

/** Records changed after the cursor. A null cursor means "all of them". */
function isDirty(record: { updatedAt: string; createdAt: string }, cursor: string | null): boolean {
  if (cursor === null) return true;
  return ts(record.updatedAt || record.createdAt) > ts(cursor);
}

/**
 * One full sync cycle. Returns zeroes when cloud sync is unconfigured or the
 * user is signed out, so callers can treat it as a no-op.
 *
 * `onChanged` fires if anything landed locally, so the caller re-reads from
 * IndexedDB and re-renders.
 */
export async function runSync(onChanged?: () => void): Promise<SyncResult> {
  const supabase = getSupabase();
  if (!supabase) return NOOP;

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return NOOP;

  const meta = await readSyncMeta();
  const previousCursor = meta.cursor;
  const now = new Date().toISOString();

  const incoming = await pullThings(supabase, userId, meta);
  await pullSettings(supabase, userId, meta);
  await pullDismissals(supabase, userId, previousCursor);

  const pushed = await pushThings(supabase, meta);
  await pushSettings(supabase, userId, meta);
  await pushDismissals(supabase, userId, meta);

  await writeSyncMeta({ ...meta, cursor: now, seeded: true });

  if (incoming.changed > 0 || incoming.removed > 0) onChanged?.();

  return { pushed, pulled: incoming.changed, removed: incoming.removed, at: now };
}

interface IncomingThings {
  changed: number;
  removed: number;
}

async function pullThings(
  supabase: Supabase,
  userId: string,
  meta: SyncMeta,
): Promise<IncomingThings> {
  let query = supabase
    .from("things")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true });

  if (meta.cursor !== null) query = query.gt("updated_at", meta.cursor);

  const { data, error } = await query;
  if (error) throw new Error(`Could not download things: ${error.message}`);

  const rows = (data ?? []) as ThingRow[];
  if (rows.length === 0) return { changed: 0, removed: 0 };

  const local = await getAllThings();
  const merged = mergeThings(local, rows);

  const deletedRemotely = new Set(rows.filter((r) => r.deleted_at).map((r) => r.id));
  const kept = merged.filter((t) => !deletedRemotely.has(t.id));
  const keptIds = new Set(kept.map((t) => t.id));

  // Only touch records the merge actually changed, rather than rewriting the
  // user's whole history on every pull.
  const changed = kept.filter((t) => {
    const before = local.find((l) => l.id === t.id);
    return !before || before.updatedAt !== t.updatedAt;
  });
  const removed = local.filter((t) => !keptIds.has(t.id));

  for (const thing of changed) await putThing(thing);
  for (const thing of removed) await deleteThing(thing.id);

  return { changed: changed.length, removed: removed.length };
}

async function pullSettings(
  supabase: Supabase,
  userId: string,
  meta: SyncMeta,
): Promise<void> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not download settings: ${error.message}`);
  if (!data) return;

  const row = data as SettingsRow;
  if (!shouldAcceptRemoteSettings(meta.settingsUpdatedAt, row.updated_at)) return;

  await saveSettings(rowToSettings(row));
}

async function pullDismissals(
  supabase: Supabase,
  userId: string,
  previousCursor: string | null,
): Promise<void> {
  let query = supabase.from("dismissals").select("*").eq("user_id", userId);
  if (previousCursor !== null) query = query.gt("dismissed_at", previousCursor);

  const { data, error } = await query;
  if (error) throw new Error(`Could not download dismissals: ${error.message}`);

  const rows = (data ?? []) as DismissalRow[];
  if (rows.length === 0) return;

  const stored = await getAllAlerts();
  const dismissed = mergeDismissals(
    new Set(stored.filter((a) => a.dismissed).map((a) => a.id)),
    rows.filter((r) => !r.deleted_at).map((r) => r.alert_id),
  );

  for (const alert of stored) {
    const shouldDismiss = dismissed.has(alert.id);
    if (alert.dismissed !== shouldDismiss) {
      await putAlert({ ...alert, dismissed: shouldDismiss });
    }
  }
}

/** Rows for a thing that was deleted locally, replayed as a tombstone. */
function tombstonePayload(id: string, deletedAt: string): Record<string, Json> {
  return {
    id,
    name: "",
    category: "home",
    kind: "reminder",
    amount: null,
    currency: "NGN",
    due_date: null,
    last_handled_date: null,
    recurrence: null,
    service_interval_days: null,
    status: "archived",
    priority: "routine",
    notes: null,
    details: {},
    created_at: deletedAt,
    updated_at: deletedAt,
    deleted_at: deletedAt,
  };
}

async function pushThings(supabase: Supabase, meta: SyncMeta): Promise<number> {
  const local = await getAllThings();
  const dirty = local.filter((t) => isDirty(t, meta.cursor));

  // A local delete removes the record from IndexedDB outright, so deletions are
  // replayed from the tombstone map instead of the things store.
  const tombstones = Object.entries(meta.tombstones);
  if (dirty.length === 0 && tombstones.length === 0) return 0;

  const payload = [
    ...dirty.map((thing: Thing) => thingToSyncPayload(thing)),
    ...tombstones.map(([id, deletedAt]) => tombstonePayload(id, deletedAt)),
  ];

  // The WHERE clause inside the SQL function is the conflict rule, so a device
  // with a skewed clock cannot overwrite newer data.
  const { error } = await supabase.rpc("upsert_things_sync", { rows: payload });
  if (error) throw new Error(`Could not upload things: ${error.message}`);

  meta.tombstones = {};
  return payload.length;
}

async function pushSettings(
  supabase: Supabase,
  userId: string,
  meta: SyncMeta,
): Promise<void> {
  const settings = await loadSettings();
  const now = new Date().toISOString();
  if (ts(now) <= ts(meta.settingsUpdatedAt)) return;

  const { error } = await supabase
    .from("settings")
    .upsert(settingsToRow(settings, userId, now), { onConflict: "user_id" });
  if (error) throw new Error(`Could not upload settings: ${error.message}`);

  meta.settingsUpdatedAt = now;
}

async function pushDismissals(
  supabase: Supabase,
  userId: string,
  meta: SyncMeta,
): Promise<void> {
  const pending = Object.entries(meta.pendingDismissals);
  if (pending.length === 0) return;

  const rows = pending.map(([alert_id, entry]) => ({
    user_id: userId,
    alert_id,
    dismissed_at: entry.at,
    deleted_at: entry.dismissed ? null : entry.at,
  }));

  const { error } = await supabase
    .from("dismissals")
    .upsert(rows, { onConflict: "user_id,alert_id" });
  if (error) throw new Error(`Could not upload dismissals: ${error.message}`);

  meta.pendingDismissals = {};
}

/** Forget sync bookkeeping so the next sync re-uploads local state in full. */
export { resetSyncMeta } from "./meta.ts";