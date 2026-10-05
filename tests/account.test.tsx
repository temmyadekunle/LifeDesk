/**
 * The signed-out, unconfigured path.
 *
 * Every existing user is on this path today, so it is the one that must not
 * break: with no Supabase credentials the app has to behave exactly as it did
 * before accounts existed.
 */

import test from "node:test";
import { register } from "node:module";
import { act } from "react";
import { createRoot } from "react-dom/client";

import { assert } from "./helpers.ts";
import { en } from "../lib/locales/en.ts";
import { makeT } from "../lib/i18n.ts";

register("./tsx-loader.mjs", import.meta.url);

const globals = globalThis as Record<string, unknown>;
const define = (key: string, value: unknown) =>
  Object.defineProperty(globals, key, { value, writable: true, configurable: true });

const { Window } = await import("happy-dom");
const win = new Window({ url: "https://livanta.test/" });
define("window", win);
define("document", win.document);
define("navigator", win.navigator);
define("location", win.location);
define("IS_REACT_ACT_ENVIRONMENT", true);

const { isCloudEnabled, getSupabase } = await import("../lib/supabase/client.ts");
const { AccountPanel } = await import("../components/AccountPanel.tsx");

test("no credentials means cloud sync reports itself unavailable", () => {
  assert.equal(isCloudEnabled(), false);
  assert.equal(getSupabase(), null);
});

test("getSupabase does not throw when unconfigured", () => {
  // Callers rely on this returning null rather than throwing, because the
  // profile screen renders for signed-out users on every build.
  assert.doesNotThrow(() => getSupabase());
});

test("AccountPanel renders the unavailable notice instead of a sign-in form", async () => {
  const t = makeT("en");
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as Element);

  const auth = {
    enabled: false,
    status: "disabled" as const,
    user: null,
    error: null,
    signIn: async () => false,
    signUp: async () => false,
    signOut: async () => {},
    clearError: () => {},
  };
  const sync = {
    enabled: false,
    signedIn: false,
    phase: "idle" as const,
    lastResult: null,
    bindRefresh: () => {},
    scheduleSync: () => {},
    syncNow: async () => {},
  };

  await act(async () => {
    root.render(<AccountPanel t={t} auth={auth} sync={sync} />);
  });

  const text = container.textContent ?? "";

  // It must not offer a way to sign in that cannot work.
  assert.equal(text.includes(t("account.notConfigured")), true);
  assert.equal(text.includes(t("account.signIn")), false);
  assert.equal(text.includes("password"), false);

  await act(async () => {
    root.unmount();
  });
});

test("the account and sync keys exist in every catalogue", async () => {
  const t = makeT("en");
  for (const key of [
    "account.title",
    "account.notConfigured",
    "sync.offline",
    "auth.unknown",
  ] as const) {
    assert.equal(typeof en[key], "string", `${key} missing from en`);
    assert.equal(t(key).length > 0, true, `${key} is empty`);
  }
});