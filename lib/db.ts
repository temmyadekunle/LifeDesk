import type { Alert, HouseholdMember, Thing } from "./types.ts";

// Internal storage key, deliberately NOT the product name. It is the
// IndexedDB database users' records live in, so changing it would orphan
// existing data with no server copy to recover from. Renamed products must
// leave this alone unless a migration is written alongside it.
const DB_NAME = "lifedesk";
const DB_VERSION = 2;

export const STORES = {
  things: "things",
  alerts: "alerts",
  members: "members",
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function indexedDBFactory(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is unavailable. Livanta data is browser-local and requires a client environment.",
    );
  }
  return indexedDB;
}

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDBFactory().open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.things)) {
        const things = db.createObjectStore(STORES.things, { keyPath: "id" });
        things.createIndex("by-category", "category", { unique: false });
        things.createIndex("by-dueDate", "dueDate", { unique: false });
        things.createIndex("by-status", "status", { unique: false });
        things.createIndex("by-priority", "priority", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.alerts)) {
        const alerts = db.createObjectStore(STORES.alerts, { keyPath: "id" });
        alerts.createIndex("by-thingId", "thingId", { unique: false });
        alerts.createIndex("by-priority", "priority", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.members)) {
        db.createObjectStore(STORES.members, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Database upgrade blocked by another open tab."));
  });

  return dbPromise;
}

function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* ---------------- things ---------------- */

export async function getAllThings(): Promise<Thing[]> {
  const things = await run<Thing[]>(STORES.things, "readonly", (s) => s.getAll());
  // Amounts saved before parseAmount existed can be NaN in IndexedDB, and NaN
  // renders as "₦NaN" while poisoning every sum it joins. Repairing on read
  // fixes existing users without a schema version bump. Only genuinely corrupt
  // records are written back, so a healthy database is never touched.
  const repaired = things.map((thing) =>
    thing.amount === null || Number.isFinite(thing.amount)
      ? thing
      : { ...thing, amount: null },
  );
  for (const [i, thing] of repaired.entries()) {
    if (thing !== things[i]) await putThing(thing);
  }
  return repaired;
}

export function putThing(thing: Thing): Promise<IDBValidKey> {
  return run<IDBValidKey>(STORES.things, "readwrite", (s) => s.put(thing));
}

export function deleteThing(id: string): Promise<undefined> {
  return run<undefined>(STORES.things, "readwrite", (s) => s.delete(id));
}

/* ---------------- alerts ---------------- */

export function getAllAlerts(): Promise<Alert[]> {
  return run<Alert[]>(STORES.alerts, "readonly", (s) => s.getAll());
}

export function putAlert(alert: Alert): Promise<IDBValidKey> {
  return run<IDBValidKey>(STORES.alerts, "readwrite", (s) => s.put(alert));
}

export function deleteAlert(id: string): Promise<undefined> {
  return run<undefined>(STORES.alerts, "readwrite", (s) => s.delete(id));
}

export function clearAlerts(): Promise<undefined> {
  return run<undefined>(STORES.alerts, "readwrite", (s) => s.clear());
}

/* ---------------- members ---------------- */

export function getAllMembers(): Promise<HouseholdMember[]> {
  return run<HouseholdMember[]>(STORES.members, "readonly", (s) => s.getAll());
}

export function putMember(member: HouseholdMember): Promise<IDBValidKey> {
  return run<IDBValidKey>(STORES.members, "readwrite", (s) => s.put(member));
}

/* ---------------- settings ---------------- */

export interface SettingRow<T> {
  key: string;
  value: T;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const row = await run<SettingRow<T> | undefined>(
    STORES.settings,
    "readonly",
    (s) => s.get(key),
  );
  return row ? row.value : null;
}

export function putSetting<T>(key: string, value: T): Promise<IDBValidKey> {
  return run<IDBValidKey>(STORES.settings, "readwrite", (s) =>
    s.put({ key, value }),
  );
}

/** Wipes every store, including settings. Used by "delete all my data". */
export async function clearAllStores(): Promise<void> {
  const db = await openDatabase();
  const names = Object.values(STORES);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    for (const name of names) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}