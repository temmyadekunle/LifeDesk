/**
 * Resolving what the signed-in user is allowed to do.
 *
 * Three rules drive this module, all from docs/Livanta Subscription Architecture.md:
 *
 * 1. Entitlements are NOT stored in IndexedDB. lib/db.ts stays at DB_VERSION 2
 *    with its four stores. A paid entitlement is a cache of server truth and is
 *    revocable; putting it beside the user's own records would mean reconciling
 *    a revocation against offline data, and would need a migration for something
 *    that is not really user data.
 *
 * 2. Fail open. A stale cache resolves to the last known plan, never to free.
 *    Withdrawing someone's access because their card lapsed while they were
 *    offline is not a defensible product decision, and it generates refunds.
 *
 * 3. Never gate access to existing data. This module answers "may the user do
 *    this new thing", and must never be used to decide whether a thing they
 *    already created can be seen or edited. Lapsing degrades capability, never
 *    records.
 *
 * The resolved plan is a hint for choosing which UI to show. It is never
 * authority: what the server honours is decided by the server.
 */

import {
  alertHorizonDays,
  can,
  GRACE_HOURS,
  isPlan,
  type Capability,
  type Plan,
} from "./plans.ts";

/**
 * What the server wrote, cached locally. `expiresAt` is an epoch milliseconds
 * timestamp supplied by the server, not computed here, so the client cannot
 * extend its own access by adjusting its clock offset relative to a fixed
 * server timestamp.
 */
export interface Entitlement {
  plan: Plan;
  /** Epoch ms at which the paid period ends. */
  expiresAt: number;
  /** True while a trial is running rather than a paid period. */
  trial: boolean;
}

const CACHE_KEY = "livanta.entitlement.v1";

/**
 * localStorage rather than IndexedDB, both because of rule 1 and because
 * entitlements are read on the first render before any async store is open.
 * Reading them synchronously avoids a render in which the user briefly sees a
 * paywall for something they have already paid for.
 */
export function readCachedEntitlement(store: Storage | null): Entitlement | null {
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    // A cache written by an older build, or hand-edited, must degrade to free
    // rather than throw during render.
    if (!isPlan(candidate.plan)) return null;
    if (typeof candidate.expiresAt !== "number" || !Number.isFinite(candidate.expiresAt)) {
      return null;
    }
    return {
      plan: candidate.plan,
      expiresAt: candidate.expiresAt,
      trial: candidate.trial === true,
    };
  } catch {
    return null;
  }
}

export function writeCachedEntitlement(store: Storage | null, value: Entitlement): void {
  if (!store) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // A full or unavailable store is not a reason to fail a sign-in. The server
    // remains authoritative and the next render re-reads.
  }
}

export function clearCachedEntitlement(store: Storage | null): void {
  if (!store) return;
  try {
    store.removeItem(CACHE_KEY);
  } catch {
    // See above.
  }
}

/**
 * Why a resolved plan is what it is. Surfaced in the UI so a user who loses a
 * capability is told which of these happened, because "you cannot do this now"
 * with no reason is the behaviour that produces a chargeback.
 */
export type EntitlementReason =
  /** No cache at all: a signed-out user, or an app built without cloud config. */
  | "anonymous"
  /** Paid period has ended, and the grace window has also run out. */
  | "lapsed"
  /** Within the grace window after a lapse. Access continues, deliberately. */
  | "grace"
  /** A trial is running. */
  | "trial"
  /** A paid period is running. */
  | "active";

export interface ResolvedEntitlement {
  plan: Plan;
  reason: EntitlementReason;
  /** Epoch ms the paid period ends, or null when there is none. */
  expiresAt: number | null;
  /**
   * True when the plan is not one the user is currently paying for. The app must
   * treat this as informational: existing data stays fully readable.
   */
  lapsed: boolean;
}

/**
 * Resolves a cached entitlement against the clock.
 *
 * `now` is a parameter rather than read from Date.now() so the lapse and grace
 * boundaries are testable without waiting, and so this stays a pure function.
 */
export function resolveEntitlement(
  cached: Entitlement | null,
  now: number,
  graceHours: number = GRACE_HOURS,
): ResolvedEntitlement {
  // A free plan has no paid period, so an expiry on one is meaningless. It must
  // not resolve to "lapsed", or the UI would tell someone who never subscribed
  // that their subscription had ended.
  if (!cached || cached.plan === "free") {
    return { plan: "free", reason: "anonymous", expiresAt: null, lapsed: false };
  }

  const remaining = cached.expiresAt - now;

  if (remaining > 0) {
    return {
      plan: cached.plan,
      reason: cached.trial ? "trial" : "active",
      expiresAt: cached.expiresAt,
      lapsed: false,
    };
  }

  // Past the period end. Within grace, keep the paid plan: the commonest cause
  // by far is a card that failed and will be retried, and degrading someone's
  // app mid-month over a transient failure is not a fair trade for tidiness.
  const withinGrace = -remaining <= graceHours * 60 * 60 * 1000;
  if (withinGrace) {
    return {
      plan: cached.plan,
      reason: "grace",
      expiresAt: cached.expiresAt,
      lapsed: false,
    };
  }

  return {
    plan: "free",
    reason: "lapsed",
    expiresAt: null,
    lapsed: true,
  };
}

/**
 * The convenience wrapper most callers want: read the cache, resolve it, ask.
 *
 * Takes the Storage so tests can pass an isolated stub and so the module never
 * touches a global directly.
 */
export function resolveFromCache(
  store: Storage | null,
  capability: Capability,
  now: number = Date.now(),
): ResolvedEntitlement & { allowed: boolean } {
  const resolved = resolveEntitlement(readCachedEntitlement(store), now);
  return { ...resolved, allowed: can(resolved.plan, capability) };
}

export { alertHorizonDays };
