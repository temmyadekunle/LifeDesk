// Hook-level tests for useLivanta.
//
// Everything else in this suite tests pure functions. This file boots the
// real hook against a DOM and a real (in-memory) IndexedDB, because the
// behaviour worth protecting is the async boot path: settings loading,
// locale selection, and alerts recomputing from persisted data. That path
// is the riskiest code in the app and had no coverage at all.
import { register } from "node:module";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { DEFAULT_SETTINGS } from "../lib/settings.ts";
import { en } from "../lib/locales/en.ts";
import { yo } from "../lib/locales/yo.ts";
import { assert } from "./helpers.ts";

register("./tsx-loader.mjs", import.meta.url);

const globals = globalThis as Record<string, unknown>;
// Node 24 defines several of these as getter-only, so plain assignment throws.
const define = (key: string, value: unknown) =>
  Object.defineProperty(globals, key, { value, writable: true, configurable: true });

// A DOM and an in-memory IndexedDB must both exist before the hook is
// imported, because db.ts resolves them as globals.
const { Window } = await import("happy-dom");
const { indexedDB, IDBKeyRange } = await import("fake-indexeddb");

const win = new Window({ url: "https://livanta.test/" });
define("window", win);
define("document", win.document);
define("navigator", win.navigator);
define("location", win.location);
define("indexedDB", indexedDB);
define("IDBKeyRange", IDBKeyRange);
// React refuses to run act() unless the environment opts in.
define("IS_REACT_ACT_ENVIRONMENT", true);

const { useLivanta } = await import("../lib/useLivanta.ts");
const { clearAllStores } = await import("../lib/db.ts");

// All of these tests share one in-memory IndexedDB, so state has to be
// cleared between them or leftover records leak into later assertions.
test.beforeEach(async () => {
  await clearAllStores();
});

type Desk = ReturnType<typeof useLivanta>;

/**
 * Renders a throwaway component that runs the hook and hands each value to
 * `onDesk`, so assertions can read the latest render without a testing
 * library. Returns a disposer plus the last observed value.
 */
function mountHook() {
  let latest: Desk | undefined;
  let renders = 0;
  const container = win.document.createElement("div");

  function Probe({ onDesk }: { onDesk: (d: Desk) => void }) {
    const desk = useLivanta();
    renders += 1;
    latest = desk;
    onDesk(desk);
    return null;
  }

  // happy-dom ships its own element types that do not match lib.dom.
const root = createRoot(container as unknown as Element);
  act(() => {
    root.render(<Probe onDesk={() => {}} />);
  });

  return {
    get desk() {
      if (!latest) throw new Error("hook never rendered");
      return latest;
    },
    get renders() {
      return renders;
    },
    async settle(): Promise<void> {
      // Boot is async IndexedDB work; flush it out of the act() queue.
      for (let i = 0; i < 40; i += 1) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 0));
        });
        if (latest?.ready) return;
      }
    },
    unmount() {
      act(() => root.unmount());
    },
  };
}

test("boots to ready without an error and with default settings", async () => {
  const h = mountHook();
  await h.settle();

  assert.equal(h.desk.ready, true, "never became ready");
  assert.equal(h.desk.loading, false, "still loading after ready");
  assert.equal(h.desk.error, null);
  assert.deepEqual(h.desk.settings, DEFAULT_SETTINGS);
  assert.deepEqual(h.desk.things, []);

  h.unmount();
});

test("defaults to English and exposes a translator", async () => {
  const h = mountHook();
  await h.settle();

  assert.equal(h.desk.settings.locale, "en");
  assert.equal(h.desk.t("app.loading"), en["app.loading"]);
  assert.equal(h.desk.t.locale, "en");

  h.unmount();
});

test("switching locale persists and changes generated alerts", async () => {
  const h = mountHook();
  await h.settle();

  await act(async () => {
    await h.desk.updateSettings({ locale: "yo" });
  });

  assert.equal(h.desk.settings.locale, "yo", "locale did not change in memory");
  assert.equal(h.desk.t.locale, "yo", "translator did not follow");
  assert.equal(h.desk.t("app.loading"), yo["app.loading"]);

  // A persisted preference must survive a remount, otherwise the user's
  // chosen language silently resets to English on the next visit.
  h.unmount();
  const again = mountHook();
  await again.settle();
  assert.equal(again.desk.settings.locale, "yo", "locale did not survive a reload");
  again.unmount();
});

test("an unknown stored locale falls back to English instead of throwing", async () => {
  const h = mountHook();
  await h.settle();

  await act(async () => {
    await h.desk.updateSettings({ locale: "zz" as never });
  });

  assert.equal(h.desk.settings.locale, "zz", "raw value should be stored as-is");
  assert.equal(h.desk.t.locale, "en", "translator should fall back to English");
  assert.equal(h.desk.t("app.loading"), en["app.loading"]);

  h.unmount();
});

test("added things come back through the hook and raise alerts", async () => {
  const h = mountHook();
  await h.settle();

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  await act(async () => {
    await h.desk.addThing({
      name: "Rent",
      category: "home",
      kind: "rent",
      amount: 50000,
      dueDate: yesterday,
      recurrence: { frequency: "monthly", interval: 1 },
      notes: "",
    });
  });

  assert.equal(h.desk.things.length, 1, "thing was not added");
  assert.equal(h.desk.things[0].name, "Rent");

  // An overdue rent is urgent, so the status must reflect it rather than
  // the empty state the hook booted with.
  assert.ok(h.desk.alerts.length > 0, "no alerts raised for an overdue thing");
  assert.equal(h.desk.status.level, "immediate");

  h.unmount();
});

test("alerts follow the locale after data exists", async () => {
  const h = mountHook();
  await h.settle();

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await act(async () => {
    await h.desk.addThing({
      name: "Rent",
      category: "home",
      kind: "rent",
      amount: 50000,
      dueDate: yesterday,
      recurrence: { frequency: "monthly", interval: 1 },
      notes: "",
    });
  });

  const englishTitle = h.desk.alerts[0].title;
  await act(async () => {
    await h.desk.updateSettings({ locale: "ig" });
  });

  assert.notEqual(h.desk.alerts[0].title, englishTitle, "alert title stayed English");
  assert.ok(!h.desk.alerts[0].title.includes("{"), "alert kept a raw placeholder");

  h.unmount();
});

test("removing a thing clears its alerts", async () => {
  const h = mountHook();
  await h.settle();

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await act(async () => {
    await h.desk.addThing({
      name: "Rent",
      category: "home",
      kind: "rent",
      amount: 50000,
      dueDate: yesterday,
      recurrence: { frequency: "monthly", interval: 1 },
      notes: "",
    });
  });
  assert.ok(h.desk.alerts.length > 0);

  const id = h.desk.things[0].id;
  await act(async () => {
    await h.desk.removeThing(id);
  });

  assert.equal(h.desk.things.length, 0, "thing was not removed");
  assert.equal(h.desk.alerts.length, 0, "alerts outlived the thing");

  h.unmount();
});

test("deleteEverything wipes stored data and resets the locale", async () => {
  const h = mountHook();
  await h.settle();

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await act(async () => {
    await h.desk.addThing({
      name: "Rent",
      category: "home",
      kind: "rent",
      amount: 50000,
      dueDate: yesterday,
      recurrence: { frequency: "monthly", interval: 1 },
      notes: "",
    });
    await h.desk.updateSettings({ locale: "ha" });
  });

  await act(async () => {
    await h.desk.deleteEverything();
  });

  assert.deepEqual(h.desk.things, []);
  assert.equal(h.desk.settings.locale, "en");

  h.unmount();
});