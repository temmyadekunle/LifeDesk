import test from "node:test";

import {
  ALL_CAPABILITIES,
  GRACE_HOURS,
  PLANS,
  TRIAL_DAYS,
  alertHorizonDays,
  can,
  isPlan,
  nextPlan,
  priceFor,
  upgradeDelta,
  type Capability,
  type Plan,
} from "../lib/plans.ts";
import {
  clearCachedEntitlement,
  readCachedEntitlement,
  resolveEntitlement,
  resolveFromCache,
  writeCachedEntitlement,
  type Entitlement,
} from "../lib/entitlements.ts";
import { assert } from "./helpers.ts";

const DAY = 24 * 60 * 60 * 1000;

/** Minimal Storage so tests do not touch the real one and cannot leak between cases. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

test("the free capabilities never move", async (t) => {
  await t.test("recording and the core insight are free on every plan", () => {
    const mustAlwaysBeFree: Capability[] = [
      "record.things",
      "record.reminders",
      "record.documents",
      "alerts.overdue",
      "alerts.fixedDate",
    ];
    for (const plan of PLANS) {
      for (const capability of mustAlwaysBeFree) {
        assert.ok(
          can(plan, capability),
          `${capability} must be free on ${plan}, because rule 3 in the architecture doc forbids charging for remembering`,
        );
      }
    }
  });

  await t.test("free grants nothing beyond those five", () => {
    for (const capability of ALL_CAPABILITIES) {
      const free = can("free", capability);
      const expected = [
        "record.things",
        "record.reminders",
        "record.documents",
        "alerts.overdue",
        "alerts.fixedDate",
      ].includes(capability);
      assert.equal(free, expected, `${capability} free-tier grant`);
    }
  });

  await t.test("paid plans are supersets of free", () => {
    for (const capability of ALL_CAPABILITIES) {
      if (can("free", capability)) {
        assert.ok(can("plus", capability), `plus lost ${capability}`);
        assert.ok(can("family", capability), `family lost ${capability}`);
      }
    }
  });
});

test("every capability is reachable", async (t) => {
  await t.test("each is granted by at least one plan", () => {
    for (const capability of ALL_CAPABILITIES) {
      assert.ok(
        PLANS.some((plan) => can(plan, capability)),
        `${capability} is granted by no plan, so it is dead weight`,
      );
    }
  });

  await t.test("and ALL_CAPABILITIES has no duplicates", () => {
    assert.equal(new Set(ALL_CAPABILITIES).size, ALL_CAPABILITIES.length);
  });
});

test("household capability is the only thing Family adds", async (t) => {
  await t.test("Family is additive over Plus, not a replacement", () => {
    for (const capability of ALL_CAPABILITIES) {
      if (can("plus", capability)) {
        assert.ok(can("family", capability), `family dropped ${capability}`);
      }
    }
  });

  await t.test("upgrading free to plus buys only automation depth", () => {
    const delta = upgradeDelta("free");
    assert.ok(delta.includes("alerts.recurrenceAware"));
    assert.ok(delta.includes("sync.crossDevice"));
    assert.ok(!delta.includes("household.members"), "Family is not part of the Plus upgrade");
    for (const capability of delta) {
      assert.ok(!can("free", capability));
    }
  });

  await t.test("the top tier has nothing to upgrade to", () => {
    assert.deepEqual(upgradeDelta("family"), []);
    assert.equal(nextPlan("family"), null);
  });
});

test("the plan ladder is ordered", async (t) => {
  await t.test("free -> plus -> family", () => {
    assert.equal(nextPlan("free"), "plus");
    assert.equal(nextPlan("plus"), "family");
  });

  await t.test("paid plans see further ahead", () => {
    assert.equal(alertHorizonDays("free"), 30);
    assert.equal(alertHorizonDays("plus"), 180);
    assert.equal(alertHorizonDays("family"), 180);
  });
});

test("isPlan rejects anything it does not recognise", async (t) => {
  await t.test("unknown strings are not plans", () => {
    for (const value of ["enterprise", "PLUS", "", "plus ", null, undefined, 42, {}]) {
      assert.equal(isPlan(value), false, `${String(value)} should not be a plan`);
    }
  });

  await t.test("the three real plans are", () => {
    for (const plan of PLANS) assert.equal(isPlan(plan), true);
  });
});

test("pricing is stored in kobo with no conversion step", async (t) => {
  await t.test("amounts are whole minor units", () => {
    for (const plan of ["plus", "family"] as const) {
      for (const interval of ["monthly", "yearly"] as const) {
        const price = priceFor(plan, interval);
        assert.ok(
          Number.isInteger(price.amountKobo),
          `${plan} ${interval} must be a whole kobo amount, got ${price.amountKobo}`,
        );
        assert.equal(price.currency, "NGN");
        assert.equal(price.interval, interval);
      }
    }
  });

  await t.test("annual costs less than twelve months of monthly", () => {
    for (const plan of ["plus", "family"] as const) {
      const monthly = priceFor(plan, "monthly").amountKobo;
      const yearly = priceFor(plan, "yearly").amountKobo;
      assert.ok(yearly < monthly * 12, `${plan} annual should be discounted`);
    }
  });

  await t.test("free has no price, because it is not a thing you can buy", () => {
    assert.ok(!("free" in ({} as Record<Plan, unknown>)));
  });

  await t.test("trial and grace are positive and sane", () => {
    assert.ok(TRIAL_DAYS > 0 && TRIAL_DAYS <= 90);
    assert.ok(GRACE_HOURS > 0 && GRACE_HOURS <= 72);
  });
});

test("a hand-edited or stale cache degrades instead of throwing", async (t) => {
  await t.test("unparseable JSON is ignored", () => {
    const store = memoryStorage();
    store.setItem("livanta.entitlement.v1", "{not json");
    assert.equal(readCachedEntitlement(store), null);
  });

  await t.test("an unknown plan is rejected", () => {
    const store = memoryStorage();
    store.setItem("livanta.entitlement.v1", JSON.stringify({ plan: "enterprise", expiresAt: 1 }));
    assert.equal(readCachedEntitlement(store), null);
  });

  await t.test("a missing or non-numeric expiry is rejected", () => {
    const store = memoryStorage();
    store.setItem("livanta.entitlement.v1", JSON.stringify({ plan: "plus" }));
    assert.equal(readCachedEntitlement(store), null);
    store.setItem(
      "livanta.entitlement.v1",
      JSON.stringify({ plan: "plus", expiresAt: "soon" }),
    );
    assert.equal(readCachedEntitlement(store), null);
  });

  await t.test("a round trip survives", () => {
    const store = memoryStorage();
    const value: Entitlement = { plan: "family", expiresAt: 1234, trial: false };
    writeCachedEntitlement(store, value);
    assert.deepEqual(readCachedEntitlement(store), value);
    clearCachedEntitlement(store);
    assert.equal(readCachedEntitlement(store), null);
  });

  await t.test("a store that throws does not break the caller", () => {
    const hostile = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("nope");
      },
    } as unknown as Storage;
    assert.equal(readCachedEntitlement(hostile), null);
    assert.doesNotThrow(() => writeCachedEntitlement(hostile, { plan: "free", expiresAt: 0, trial: false }));
    assert.doesNotThrow(() => clearCachedEntitlement(hostile));
  });

  await t.test("a null store is allowed, for builds with no localStorage", () => {
    assert.equal(readCachedEntitlement(null), null);
    assert.doesNotThrow(() => writeCachedEntitlement(null, { plan: "plus", expiresAt: 1, trial: false }));
  });
});

test("resolveEntitlement fails open", async (t) => {
  const now = 1_000_000;

  await t.test("no cache means free, and is not a lapse", () => {
    const resolved = resolveEntitlement(null, now);
    assert.equal(resolved.plan, "free");
    assert.equal(resolved.reason, "anonymous");
    assert.equal(resolved.lapsed, false);
  });

  await t.test("a running trial reports trial", () => {
    const resolved = resolveEntitlement({ plan: "plus", expiresAt: now + DAY, trial: true }, now);
    assert.equal(resolved.plan, "plus");
    assert.equal(resolved.reason, "trial");
    assert.equal(resolved.lapsed, false);
  });

  await t.test("a running paid period reports active", () => {
    const resolved = resolveEntitlement({ plan: "plus", expiresAt: now + DAY, trial: false }, now);
    assert.equal(resolved.reason, "active");
    assert.equal(resolved.plan, "plus");
  });

  await t.test("a just-expired period keeps access through the grace window", () => {
    const resolved = resolveEntitlement(
      { plan: "plus", expiresAt: now - 60_000, trial: false },
      now,
    );
    assert.equal(resolved.plan, "plus", "a failed card retry must not degrade the app mid-month");
    assert.equal(resolved.reason, "grace");
    assert.equal(resolved.lapsed, false);
  });

  await t.test("the grace window is hours, not days", () => {
    // A days-based field set to 24 would grant a month of unpaid access.
    assert.ok(
      GRACE_HOURS * 60 * 60 * 1000 <= 3 * 24 * 60 * 60 * 1000,
      "grace must not exceed three days",
    );
    const justInside = resolveEntitlement(
      { plan: "plus", expiresAt: now - (GRACE_HOURS - 1) * 60 * 60 * 1000, trial: false },
      now,
    );
    assert.equal(justInside.plan, "plus");
    const justOutside = resolveEntitlement(
      { plan: "plus", expiresAt: now - (GRACE_HOURS + 1) * 60 * 60 * 1000, trial: false },
      now,
    );
    assert.equal(justOutside.plan, "free");
  });

  await t.test("past grace, capability goes but the reason is recorded", () => {
    const resolved = resolveEntitlement(
      { plan: "plus", expiresAt: now - (GRACE_HOURS + 2) * 60 * 60 * 1000, trial: false },
      now,
    );
    assert.equal(resolved.plan, "free");
    assert.equal(resolved.reason, "lapsed");
    assert.equal(resolved.lapsed, true);
  });

  await t.test("free never lapses, however stale its expiry", () => {
    const resolved = resolveEntitlement(
      { plan: "free", expiresAt: now - 999 * DAY, trial: false },
      now,
    );
    assert.equal(resolved.plan, "free");
    assert.equal(
      resolved.lapsed,
      false,
      "someone who never subscribed must not be told their subscription ended",
    );
    assert.equal(resolved.reason, "anonymous");
  });
});

test("resolveFromCache grants on the resolved plan, not the cached one", async (t) => {
  const now = 1_000_000;

  await t.test("an active plan grants its capabilities", () => {
    const store = memoryStorage();
    writeCachedEntitlement(store, { plan: "plus", expiresAt: now + DAY, trial: false });
    assert.equal(resolveFromCache(store, "sync.crossDevice", now).allowed, true);
    assert.equal(resolveFromCache(store, "household.members", now).allowed, false);
  });

  await t.test("a lapsed plan stops new capability", () => {
    const store = memoryStorage();
    writeCachedEntitlement(store, {
      plan: "plus",
      expiresAt: now - (GRACE_HOURS + 2) * 60 * 60 * 1000,
      trial: false,
    });
    const resolved = resolveFromCache(store, "sync.crossDevice", now);
    assert.equal(resolved.allowed, false);
    assert.equal(resolved.lapsed, true);
  });

  await t.test("but the free capabilities survive the lapse", () => {
    const store = memoryStorage();
    writeCachedEntitlement(store, {
      plan: "family",
      expiresAt: now - (GRACE_HOURS + 2) * 60 * 60 * 1000,
      trial: false,
    });
    // Rule 3: a lapse may never withhold access to what the user already has.
    assert.equal(resolveFromCache(store, "record.things", now).allowed, true);
    assert.equal(resolveFromCache(store, "alerts.overdue", now).allowed, true);
    assert.equal(resolveFromCache(store, "record.documents", now).allowed, true);
    assert.equal(resolveFromCache(store, "household.members", now).allowed, false);
  });

  await t.test("an empty store resolves free without touching anything", () => {
    const store = memoryStorage();
    const resolved = resolveFromCache(store, "alerts.overdue", now);
    assert.equal(resolved.allowed, true);
    assert.equal(resolved.plan, "free");
  });
});
