/**
 * Sync conflict rules.
 *
 * These are the tests that matter most in this project: the cloud table is the
 * only copy of a signed-in user's data, so a wrong decision in mergeThings is
 * unrecoverable. Everything here runs without a network or a Supabase project.
 */

import test from "node:test";

import { assert, makeThing } from "./helpers.ts";
import type { Category, Thing } from "../lib/types.ts";
import type { SettingsRow, ThingRow } from "../lib/supabase/types.ts";
import {
  mergeDismissals,
  mergeThings,
  shouldAcceptRemoteSettings,
  ts,
} from "../lib/sync/merge.ts";
import {
  rowToSettings,
  rowToThing,
  settingsToRow,
  thingToRow,
  thingToSyncPayload,
} from "../lib/sync/rows.ts";
import { DEFAULT_SETTINGS } from "../lib/settings.ts";

/** Postgres returns timestamptz with an offset; the browser sends Z. */
const PG = (iso: string) => new Date(iso).toISOString().replace("Z", "+00:00");

test("ts parses both Postgres and browser timestamp formats alike", () => {
  const iso = "2026-10-04T12:00:00.000Z";
  assert.equal(ts(iso), ts(PG(iso)));
  assert.equal(ts("2026-10-04T12:00:01.000Z") > ts(iso), true);
  assert.equal(ts(null), 0);
  assert.equal(ts("not a date"), 0);
});

test("mergeThings keeps the local copy when the remote row is older", () => {
  const local = [makeThing({ id: "a", name: "Local", updatedAt: "2026-10-04T00:00:00.000Z" })];
  const row = thingToRow(
    makeThing({ id: "a", name: "Stale remote", updatedAt: "2026-10-01T00:00:00.000Z" }),
    "u",
  );

  const merged = mergeThings(local, [row]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "Local");
});

test("mergeThings takes the remote copy when it is strictly newer", () => {
  const local = [makeThing({ id: "a", name: "Local", updatedAt: "2026-10-01T00:00:00.000Z" })];
  const row = thingToRow(
    makeThing({ id: "a", name: "Newer remote", updatedAt: "2026-10-05T00:00:00.000Z" }),
    "u",
  );

  const merged = mergeThings(local, [row]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "Newer remote");
});

test("mergeThings keeps the local copy when timestamps are exactly equal", () => {
  const stamp = "2026-10-04T00:00:00.000Z";
  const local = [makeThing({ id: "a", name: "Local", updatedAt: stamp })];
  const row = thingToRow(makeThing({ id: "a", name: "Remote", updatedAt: stamp }), "u");

  const merged = mergeThings(local, [row]);

  assert.equal(merged[0].name, "Local");
});

test("mergeThings compares timestamps numerically, not as text", () => {
  // "2026-10-04T12:00:00+00:00" sorts after "...12:00:00.000Z" as a string only
  // by accident; as instants they are equal, so the local copy must survive.
  const local = [makeThing({ id: "a", updatedAt: "2026-10-04T12:00:00.000Z" })];
  const row = thingToRow(
    makeThing({ id: "a", name: "Remote", updatedAt: PG("2026-10-04T12:00:00.000Z") }),
    "u",
  );

  const merged = mergeThings(local, [row]);

  assert.equal(merged[0].name, "Test thing");
});

test("a tombstone deletes the record even when it is older than the local edit", () => {
  const local = [makeThing({ id: "a", updatedAt: "2026-10-09T00:00:00.000Z" })];
  const row: ThingRow = {
    ...thingToRow(makeThing({ id: "a" }), "u"),
    updated_at: "2026-10-01T00:00:00.000Z",
    deleted_at: "2026-10-01T00:00:00.000Z",
  };

  const merged = mergeThings(local, [row]);

  assert.equal(merged.length, 0);
});

test("mergeThings appends unknown records without disturbing existing order", () => {
  const local = [
    makeThing({ id: "a", updatedAt: "2026-01-01T00:00:00.000Z" }),
    makeThing({ id: "b", updatedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const rows = [
    thingToRow(makeThing({ id: "z", updatedAt: "2026-02-01T00:00:00.000Z" }), "u"),
    thingToRow(makeThing({ id: "m", updatedAt: "2026-02-01T00:00:00.000Z" }), "u"),
  ];

  const merged = mergeThings(local, rows);

  assert.deepEqual(
    merged.map((t: Thing) => t.id),
    ["a", "b", "z", "m"],
  );
});

test("mergeThings returns the same array when there is nothing to merge", () => {
  const local = [makeThing({ id: "a" })];
  assert.equal(mergeThings(local, []), local);
});

test("mergeThings applies an edit and a delete in one batch", () => {
  const local = [
    makeThing({ id: "a", name: "Old", updatedAt: "2026-01-01T00:00:00.000Z" }),
    makeThing({ id: "b", updatedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const rows = [
    thingToRow(makeThing({ id: "a", name: "Edited", updatedAt: "2026-03-01T00:00:00.000Z" }), "u"),
    { ...thingToRow(makeThing({ id: "b" }), "u"), deleted_at: "2026-03-01T00:00:00.000Z" },
  ];

  const merged = mergeThings(local, rows);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "Edited");
});

test("mergeDismissals unions ids and never drops a local dismissal", () => {
  const merged = mergeDismissals(new Set(["local-1"]), ["remote-1"]);
  assert.deepEqual([...merged].sort(), ["local-1", "remote-1"]);
});

test("mergeDismissals returns the same set when there is nothing remote", () => {
  const local = new Set(["a"]);
  assert.equal(mergeDismissals(local, []), local);
});

test("remote settings win only when strictly newer", () => {
  assert.equal(shouldAcceptRemoteSettings("2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z"), true);
  assert.equal(shouldAcceptRemoteSettings("2026-10-02T00:00:00.000Z", "2026-10-01T00:00:00.000Z"), false);
  assert.equal(shouldAcceptRemoteSettings("2026-10-02T00:00:00.000Z", "2026-10-02T00:00:00.000Z"), false);
  assert.equal(shouldAcceptRemoteSettings(null, "2026-10-01T00:00:00.000Z"), true);
});

test("a Thing survives a full row round trip", () => {
  const thing = makeThing({
    id: "round-trip",
    name: "School fees",
    amount: 250000,
    dueDate: "2026-11-01",
    recurrence: { frequency: "termly" as never, interval: 1 },
    serviceIntervalDays: 90,
    notes: "Ask for receipt",
    details: { school: "Command Primary" },
    updatedAt: "2026-10-04T08:30:00.000Z",
  });

  const back = rowToThing(thingToRow(thing, "user-1"));

  assert.deepEqual(back, thing);
});

test("a null amount stays null rather than becoming zero", () => {
  const row = thingToRow(makeThing({ amount: null }), "u");
  assert.equal(row.amount, null);
  assert.equal(rowToThing(row)?.amount, null);
});

test("a tombstoned row maps to null instead of a Thing", () => {
  const row: ThingRow = {
    ...thingToRow(makeThing(), "u"),
    deleted_at: "2026-10-04T00:00:00.000Z",
  };
  assert.equal(rowToThing(row), null);
});

test("the sync payload omits user_id so the client cannot target another account", () => {
  const payload = thingToSyncPayload(makeThing());
  assert.equal("user_id" in payload, false);
  assert.equal(payload.id, "test-id");
});

test("settings survive a round trip through a row", () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    onboarded: true,
    displayName: "Temmy",
    locale: "ha" as const,
    dataSaver: false,
    notifyUrgent: false,
    leadDays: [14, 7, 1],
    managedCategories: ["money", "family"] as Category[],
  };

  const row = settingsToRow(settings, "user-1", "2026-10-04T00:00:00.000Z") as SettingsRow;
  const back = rowToSettings(row);

  assert.deepEqual(back, settings);
});