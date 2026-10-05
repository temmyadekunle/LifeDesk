/**
 * Service worker registration.
 *
 * Kept out of LivantaApp on purpose. Registration is a platform concern rather
 * than part of any screen, and it must survive every render path (onboarding,
 * auth, the signed-out shell). Putting it in the root component would mean
 * every future gate has to remember it still needs to mount.
 *
 * Nothing here throws. A failed registration costs offline support and nothing
 * else, so it must never be able to take the app down with it.
 */

export type SwUpdateState = "none" | "installed" | "activated";

export interface RegisterOptions {
  /** "installed" means a newer worker is ready; "activated" is the first install. */
  onUpdate?: (state: SwUpdateState) => void;
  onError?: (error: unknown) => void;
}

/** Where the worker lives. Must match the file in public/. */
export const SW_URL = "/sw.js";

/**
 * A newer worker is installed by a background fetch, not by the page load that
 * registered it, so activation has to be requested explicitly. Left to wait for
 * every tab to close, an update can sit dormant for weeks on a phone that is
 * rarely fully closed.
 */
export const SKIP_WAITING = "SKIP_WAITING";

export function isSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Registers /sw.js and wires up update handling. Returns a cleanup function.
 *
 * Safe to call in any environment: outside a browser, or where service workers
 * are unsupported, it does nothing rather than throwing.
 */
export function registerServiceWorker(options: RegisterOptions = {}): () => void {
  const { onUpdate, onError } = options;

  if (typeof window === "undefined" || !isSupported()) {
    onUpdate?.("none");
    return () => {};
  }

  let cancelled = false;

  const run = async () => {
    try {
      // Deliberately not awaited before the app continues: blocking first paint
      // on registration would make a slow worker upgrade feel like a slow start.
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: "/",
      });

      if (cancelled) return;

      // A worker can finish installing between page load and this call.
      if (registration.waiting) {
        onUpdate?.("installed");
        notify(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          if (installing.state !== "installed") return;
          if (navigator.serviceWorker.controller) {
            // An older worker is still in charge, so this is a real update
            // rather than the very first install.
            onUpdate?.("installed");
            notify(installing);
          } else {
            onUpdate?.("activated");
          }
        });
      });
    } catch (error) {
      onError?.(error);
    }
  };

  void run();

  return () => {
    cancelled = true;
  };
}

/** Ask a waiting worker to take over immediately. */
export function activateWaitingWorker(): void {
  if (typeof navigator === "undefined" || !isSupported()) return;
  void navigator.serviceWorker
    .getRegistration("/")
    .then((registration) => {
      if (registration?.waiting) notify(registration.waiting);
    })
    .catch(() => {
      /* an unreachable worker is not worth failing a click over */
    });
}

function notify(worker: ServiceWorker) {
  try {
    worker.postMessage(SKIP_WAITING);
  } catch {
    /* see above */
  }
}
