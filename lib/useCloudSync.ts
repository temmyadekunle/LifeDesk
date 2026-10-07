/**
 * Drives sync for the app: a cycle on sign-in, a debounced cycle after edits,
 * and one when the tab regains focus.
 *
 * Debouncing matters because editing a thing fires several mutations in quick
 * succession, and syncing on each one would mean a request per keystroke-level
 * change on a metered connection.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { runSync, type SyncPhase, type SyncResult } from "./sync/engine.ts";
import { useAuth } from "./useAuth.ts";

export interface UseCloudSync {
  enabled: boolean;
  signedIn: boolean;
  phase: SyncPhase;
  lastResult: SyncResult | null;
  online: boolean;
  dataSaver: boolean;
  /** Called when a cycle pulled changes down, so the app re-reads local data. */
  bindRefresh: (refresh: () => void) => void;
  /** Queue a sync, coalescing rapid calls. */
  scheduleSync: () => void;
  syncNow: () => Promise<void>;
}

const DEBOUNCE_MS = 2000;

export interface CloudSyncOptions {
  /**
   * When the user has asked for low-data mode, background syncing is skipped.
   * The Profile screen promises that data saver keeps sync off, so this has to
   * be honoured or the copy is a lie. An explicit "Sync now" still runs.
   */
  dataSaver?: boolean;
}

export function useCloudSync({ dataSaver = false }: CloudSyncOptions = {}): UseCloudSync {
  const { enabled, status } = useAuth();
  const signedIn = status === "signed-in";

  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [online, setOnline] = useState(
    () => typeof window === "undefined" || window.navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const refreshRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  const bindRefresh = useCallback((refresh: () => void) => {
    refreshRef.current = refresh;
  }, []);

  const syncNow = useCallback(async () => {
    if (!enabled || !signedIn) return;
    // A cycle already in flight will pick up anything queued behind it, so
    // overlapping cycles are skipped rather than queued.
    if (runningRef.current) return;

    runningRef.current = true;
    setPhase("syncing");
    try {
      const result = await runSync(() => refreshRef.current?.());
      setLastResult(result);
      setPhase("done");
    } catch {
      // Sync failures are never surfaced as blocking errors: the app is fully
      // usable offline, so the next cycle will simply try again.
      setPhase("error");
    } finally {
      runningRef.current = false;
    }
  }, [enabled, signedIn]);

  const scheduleSync = useCallback(() => {
    if (!enabled || !signedIn) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void syncNow();
    }, DEBOUNCE_MS);
  }, [enabled, signedIn, syncNow]);

  // First cycle once a session exists, which is also when local data is
  // uploaded for the first time.
  useEffect(() => {
    if (!enabled || !signedIn) return;
    void syncNow();
  }, [enabled, signedIn, syncNow]);

  // A household app is mostly left open on a phone and on a laptop, so
  // catching up when the tab becomes visible is the sync that matters. It is
  // skipped in low-data mode, where the user has asked Livanta to stay quiet
  // unless they trigger it themselves.
  useEffect(() => {
    if (!enabled || !signedIn) return;

    const onVisible = () => {
      if (dataSaver) return;
      if (document.visibilityState === "visible") void syncNow();
    };
    if (!dataSaver) {
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onVisible);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, signedIn, dataSaver, syncNow]);

  return {
    enabled,
    signedIn,
    phase,
    lastResult,
    online,
    dataSaver,
    bindRefresh,
    scheduleSync,
    syncNow,
  };
}