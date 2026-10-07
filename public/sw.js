/**
 * Livanta service worker.
 *
 * This exists to make the app work with no network, which matters more here
 * than in a typical PWA. Everything the user records lives in IndexedDB on
 * their own device, so a dropped connection loses nothing if the shell still
 * loads. Without this file, going offline shows the browser's dinosaur page
 * even though every one of the user's documents and bills is sitting right
 * there in storage.
 *
 * Strategy, and why each part differs:
 *
 *   Navigation requests  network-first, cache as fallback. A stale HTML shell
 *                       is worse than no shell, so the network is always tried
 *                       first. Cached only as the offline fallback.
 *   Hashed build output  cache-first. Filenames under /_next/static/ contain a
 *                       content hash, so the bytes behind a URL can never
 *                       change and revalidation is pure latency.
 *   Icons and manifest   stale-while-revalidate: served from cache instantly,
 *                       then refreshed in the background. These are unhashed,
 *                       so cache-first would pin the old bytes forever and
 *                       every icon change would need a CACHE_VERSION bump to
 *                       become visible. SWR means one reload picks up a
 *                       redeployed icon with no coordination at all.
 *   Everything else      straight to the network, never cached. Supabase
 *                       especially: auth and sync responses must never be
 *                       replayed from cache.
 *
 * CACHE_VERSION is the lever for shipping an update to the shell itself.
 * Bumping it creates a new cache, and activate deletes every cache that is
 * not the new one, so a stale shell cannot survive an update. Bump it in any
 * commit that changes app/layout.tsx, app/globals.css or this file. Unhashed
 * icons and the manifest no longer need a bump (see SWR above), and hashed
 * /_next/static/ output never did.
 */
const CACHE_VERSION = "v2";
const SHELL_CACHE = `livanta-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `livanta-assets-${CACHE_VERSION}`;

/** The minimum needed to boot the app and read IndexedDB while offline. */
const SHELL_URLS = ["/", "/index.html", "/offline.html"];

/** Unhashed assets worth keeping, because a missing icon is very visible. */
const PRECACHE_URLS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // addAll is atomic: if any one URL fails, none are cached and the
      // install fails loudly. That is deliberate. A partial shell would leave
      // the app rendering without its stylesheet offline, which is harder to
      // diagnose than a failed install. Individual precaches that are allowed
      // to fail are listed in the second, non-atomic pass below.
      await cache.addAll(SHELL_URLS);

      const assets = await caches.open(ASSET_CACHE);
      // Best-effort: a missing icon must not block the whole install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          assets.add(url).catch(() => {
            /* absent is survivable */
          }),
        ),
      );

      // Take over immediately rather than waiting for every tab to close. The
      // risk with skipWaiting is a half-updated session, but that risk is
      // handled by the delete-old-caches step below rather than left to chance.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Lets the page ask a waiting worker to activate now, and lets the page learn
 * that an update is live. Without the message channel the user would keep
 * running the old shell until every tab was closed.
 */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHashedBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isPrecachedAsset(url) {
  return PRECACHE_URLS.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable. A POST to Supabase must always reach the network,
  // and caching one would be a correctness bug, not a performance win.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch another origin. Supabase lives on *.supabase.co and this worker
  // has no business answering for it.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isHashedBuildAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isPrecachedAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // No respondWith: the browser handles it normally. Explicit rather than
  // default so that adding a rule later cannot silently change this path.
});

async function handleNavigation(event) {
  const { request } = event;
  try {
    const fresh = await fetch(request);
    // Only a real, complete response is worth storing. An error page saved
    // here would be replayed as the offline shell forever after.
    if (fresh && fresh.ok && fresh.type === "basic") {
      const cache = await caches.open(SHELL_CACHE);
      // The resolved URL, not request.url: fetch follows redirects, and caching
      // the pre-redirect URL would pin the wrong key.
      await cache.put(new URL(fresh.url).pathname, fresh.clone());
    }
    return fresh;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const url = new URL(request.url);
    // Any route can be requested directly (a bookmark, a share link, the back
    // button), so try that exact path before falling back to the root shell.
    // deep:true because the export writes each route to /route/index.html.
    return (
      (await cache.match(url.pathname)) ??
      (await cache.match(url.pathname, { ignoreSearch: true })) ??
      (await cache.match("/index.html")) ??
      (await cache.match("/offline.html")) ??
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok && fresh.type === "basic") {
    await cache.put(request, fresh.clone());
  }
  return fresh;
}

/**
 * Serve the cached copy immediately, then fetch the truth and store it for the
 * next visit. The user never waits on the network, and a redeployed icon or
 * manifest still lands after a single reload instead of surviving forever in a
 * cache that only a version bump would clear.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (fresh) => {
      if (fresh && fresh.ok && fresh.type === "basic") {
        await cache.put(request, fresh.clone());
      }
      return fresh;
    })
    .catch(() => undefined);

  if (cached) {
    // Wait for the refresh only long enough to surface a network error; the
    // cached copy is the answer regardless, since this is an offline-first app.
    return cached;
  }
  const fresh = await refresh;
  if (!fresh) return new Response("", { status: 504 });
  return fresh;
}
