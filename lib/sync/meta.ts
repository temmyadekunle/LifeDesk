/**
 * Local sync bookkeeping, kept out of the Settings object so that enabling sync
 * never changes what the user sees in their profile.
 *
 * Stored in the existing IndexedDB `settings` store under a reserved key, so it
 * needs no schema migration and survives alongside everything else.
 */

import { getSetting, putSetting } from "../db.ts";

export const SYNC_META_KEY = "__livanta_sync_meta";

export interface SyncMeta {
  /** Highest updated_at covered by a completed sync. */
  cursor: string | null;
  /** updated_at of the local settings row last pushed. */
  settingsUpdatedAt: string | null;
  /** thingId -> deletion time, for local deletes awaiting propagation. */
  tombstones: Record<string, string>;
  /** alertId -> state, for dismissal changes awaiting push. */
  pendingDismissals: Record<string, { dismissed: boolean; at: string }>;
  /** True once a full cycle has run, so local data is known to be uploaded. */
  seeded: boolean;
}

export const EMPTY_SYNC_META: SyncMeta = {
  cursor: null,
  settingsUpdatedAt: null,
  tombstones: {},
  pendingDismissals: {},
  seeded: false,
};

function coerce(raw: unknown): SyncMeta {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SYNC_META };
  const value = raw as Partial<SyncMeta>;
  return {
    cursor: typeof value.cursor === "string" ? value.cursor : null,
    settingsUpdatedAt:
      typeof value.settingsUpdatedAt === "string" ? value.settingsUpdatedAt : null,
    tombstones:
      value.tombstones && typeof value.tombstones === "object" ? value.tombstones : {},
    pendingDismissals:
      value.pendingDismissals && typeof value.pendingDismissals === "object"
        ? value.pendingDismissals
        : {},
    seeded: value.seeded === true,
  };
}

export async function readSyncMeta(): Promise<SyncMeta> {
  return coerce(await getSetting<SyncMeta>(SYNC_META_KEY));
}

export async function writeSyncMeta(meta: SyncMeta): Promise<void> {
  await putSetting(SYNC_META_KEY, meta);
}

/**
 * Record a local deletion so it can be propagated as a tombstone.
 *
 * Lives here rather than in sync/engine.ts so that the core data hook can
 * record changes without importing the Supabase SDK at all. That keeps the
 * signed-out, offline-only path free of the cloud client.
 */
export async function recordDeletion(thingId: string): Promise<void> {
  const meta = await readSyncMeta();
  meta.tombstones = { ...meta.tombstones, [thingId]: new Date().toISOString() };
  await writeSyncMeta(meta);
}

/** Record a dismissal change so it can be propagated. */
export async function recordDismissal(alertId: string, dismissed: boolean): Promise<void> {
  const meta = await readSyncMeta();
  meta.pendingDismissals = {
    ...meta.pendingDismissals,
    [alertId]: { dismissed, at: new Date().toISOString() },
  };
  await writeSyncMeta(meta);
}

/** Forget sync bookkeeping so the next sync re-uploads local state in full. */
export async function resetSyncMeta(): Promise<void> {
  await writeSyncMeta({
    cursor: null,
    settingsUpdatedAt: null,
    tombstones: {},
    pendingDismissals: {},
    seeded: false,
  });
}