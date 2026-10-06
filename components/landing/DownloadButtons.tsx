"use client";

/**
 * Store download controls.
 *
 * Every badge reads from lib/landing/store.ts. Because the store URLs are empty
 * until the apps are published, the badges render as non-interactive elements
 * with a "coming soon" label rather than links. That is the whole point: a
 * visitor cannot be sent to a store search that finds nothing, and the day a
 * real URL lands in the config these become ordinary links with no other change.
 *
 * The badge artwork below is a deliberately plain, self-drawn approximation, not
 * the official Google Play or Apple artwork. Shipping the official badges is a
 * trademark licence question and also requires their exact geometry, so replace
 * these with the official assets from each store's brand guidelines before
 * publishing. The accessible names and layout will not change when you do.
 */
import { useSyncExternalStore } from "react";
import { ANY_STORE_AVAILABLE, STORE_LIST, storeForDevice, type Store } from "@/lib/landing/store";

/** Recognisable without impersonating the official artwork. */
function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 2.9v18.2a1 1 0 0 0 1.5.87l15.2-9.1a1 1 0 0 0 0-1.74L5.5 2.03A1 1 0 0 0 4 2.9Z" fill="currentColor" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85s-1.85-.83-3-.81c-1.55.02-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.9 2.25 1.2-.05 1.6-.72 3-.72s1.85.72 3 .7c1.25 0 2-1.1 2.75-2.2.9-1.25 1.25-2.5 1.3-2.55-.05 0-2.4-.95-2.35-3.62ZM14.1 5.4c.65-.8 1.1-1.9.98-3-.95.04-2.1.65-2.8 1.45-.6.7-1.15 1.85-1 2.95 1.05.08 2.15-.55 2.82-1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

const GLYPHS = { "google-play": PlayGlyph, "app-store": AppleGlyph } as const;

function Badge({ store, size }: { store: Store; size: "lg" | "md" }) {
  const Glyph = GLYPHS[store.id];
  const className = `lp-badge lp-badge--${size}${store.available ? "" : " is-pending"}`;

  const inner = (
    <>
      <Glyph />
      <span className="lp-badge__text">
        <span className="lp-badge__small">
          {store.id === "app-store" ? "Download on the" : "Get it on"}
        </span>
        <span className="lp-badge__name">{store.name}</span>
      </span>
    </>
  );

  // A link when there is somewhere to go, a labelled placeholder when there is
  // not. Deliberately not <a href="">: that is a real link that reloads the page
  // and reads as broken to assistive tech.
  if (!store.available) {
    return (
      <span className={className} aria-disabled="true" title={store.unavailableLabel}>
        {inner}
        <span className="lp-badge__soon">{store.platform}</span>
      </span>
    );
  }

  return (
    <a className={className} href={store.url} rel="noopener noreferrer">
      {inner}
    </a>
  );
}

/**
 * The two store badges plus a status line.
 *
 * `tone` picks the wording: the hero promises the app, the closing section
 * explains why a tap does nothing yet, and the sticky bar stays quiet.
 */
export function DownloadButtons({
  size = "lg",
  align = "center",
  showNote = true,
  className = "",
}: {
  size?: "lg" | "md";
  align?: "center" | "start";
  showNote?: boolean;
  className?: string;
}) {
  const published = STORE_LIST.filter((s) => s.available);

  return (
    <div className={`lp-downloads lp-downloads--${align} ${className}`}>
      <div className="lp-downloads__row">
        {STORE_LIST.map((store) => (
          <Badge key={store.id} store={store} size={size} />
        ))}
      </div>
      {showNote && (
        <p className="lp-downloads__note">
          {published.length === 0 ? (
            <>
              <strong>Coming soon.</strong> Livanta is in final testing for both stores.
              The app already works on the web and installs to your home screen.
            </>
          ) : published.length === 1 ? (
            <>Available on {published[0].name}. The other store is on the way.</>
          ) : (
            <>Free to download. Your data stays on your device.</>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * The sticky mobile action bar.
 *
 * Only appears on a phone, because a desktop has no store build to open. It
 * routes to the store that matches the device when there is one, and otherwise
 * explains that the listing is not up yet, which is the only honest thing to
 * put under a thumb.
 */

/* Which store a device wants is a fact about the browser, not about anything
   React is managing, and it cannot change while the page is open. So there is
   no event to subscribe to: the only thing React needs is a way to read the
   server's answer (nothing, it has no navigator) and this browser's answer.

   Reading it this way also means no `useState` in an effect, which would paint
   a "Coming soon" bar and then repaint it a moment later the moment a store
   does exist. */
const subscribeToNothing = () => () => {};
const noStoreOnServer = () => null;
const storeOnThisDevice = (): Store | null =>
  storeForDevice(navigator.userAgent, navigator.maxTouchPoints);

export function StickyCta() {
  const store = useSyncExternalStore(subscribeToNothing, storeOnThisDevice, noStoreOnServer);

  // Nothing to offer yet, so the bar stays out of the way entirely rather than
  // parking a dead button over the bottom of every page.
  if (!ANY_STORE_AVAILABLE) return null;

  return (
    <div className="lp-sticky">
      <div className="lp-sticky__inner">
        <span className="lp-sticky__text">
          <strong>Livanta</strong>
          <span>{store ? `Get it on ${store.name}` : "Coming soon to the stores"}</span>
        </span>
        {store ? (
          <a className="btn btn--primary btn--sm" href={store.url} rel="noopener noreferrer">
            Download
          </a>
        ) : (
          <span className="btn btn--primary btn--sm is-disabled" aria-disabled="true">
            Download
          </span>
        )}
      </div>
    </div>
  );
}
