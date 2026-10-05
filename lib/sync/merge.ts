/**
 * Conflict resolution for pulled cloud rows.
 *
 * Kept as pure functions so the rules can be tested without a network or a
 * Supabase project: every decision that could lose a user's data lives here.
 *
 * The rule throughout is last-write-wins per record, with two exceptions:
 *   - A tombstone always wins, whatever its timestamp. Propagating a delete
 *     matters more than preserving an edit to a record that no longer exists.
 *   - An exactly-equal timestamp keeps the local copy, so a row that merely
 *     echoes what we already hold never causes a needless rewrite.
 */

import type { Thing } from "../types.ts";
import type { ThingRow } from "../supabase/types.ts";
import { rowToThing } from "./rows.ts";

/** Epoch ms for an ISO string, or 0 when missing or unparseable. */
export function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Merge pulled rows into the local list.
 *
 * Local order is preserved and genuinely new records are appended, because the
 * dashboard renders this array directly and re-sorting here would make things
 * jump around after every pull.
 */
export function mergeThings(local: Thing[], rows: ThingRow[]): Thing[] {
  if (rows.length === 0) return local;

  const byId = new Map<string, Thing>();
  for (const thing of local) byId.set(thing.id, thing);

  for (const row of rows) {
    const existing = byId.get(row.id);

    if (row.deleted_at) {
      byId.delete(row.id);
      continue;
    }

    if (!existing) {
      const fresh = rowToThing(row);
      if (fresh) byId.set(row.id, fresh);
      continue;
    }

    // Strictly newer only: equal keeps local, older never overwrites.
    if (ts(row.updated_at) > ts(existing.updatedAt)) {
      const fresh = rowToThing(row);
      if (fresh) byId.set(row.id, fresh);
    }
  }

  // Rebuild from the map so replacements and deletions land, while the original
  // sequence is kept for everything that survived.
  const result: Thing[] = [];
  const emitted = new Set<string>();
  for (const thing of local) {
    const next = byId.get(thing.id);
    if (next && !emitted.has(next.id)) {
      result.push(next);
      emitted.add(next.id);
    }
  }
  for (const thing of byId.values()) {
    if (!emitted.has(thing.id)) result.push(thing);
  }

  return result;
}

/**
 * Union locally dismissed alert ids with those dismissed elsewhere.
 *
 * Dismissals are never dropped by a pull: a dismissal is an explicit "not now",
 * and resurrecting an alert the user already dealt with is the kind of thing
 * that makes people stop trusting an app.
 */
export function mergeDismissals(local: Set<string>, remote: string[]): Set<string> {
  if (remote.length === 0) return local;
  const merged = new Set(local);
  for (const id of remote) merged.add(id);
  return merged;
}

/** Settings are a single row, so the strictly newer timestamp simply wins. */
export function shouldAcceptRemoteSettings(
  localUpdatedAt: string | null,
  remoteUpdatedAt: string,
): boolean {
  return ts(remoteUpdatedAt) > ts(localUpdatedAt);
}