/**
 * Plans, capabilities and pricing.
 *
 * Pure logic: no imports, no I/O, no React. That is deliberate. This module is
 * the single source of truth for what "Plus" means, and it must be testable and
 * readable on its own, so that the pricing page, the entitlement resolver and
 * the tests cannot disagree.
 *
 * The design rule that shapes everything here is in docs/Livanta Subscription
 * Architecture.md: remembering is free. Livanta charges for automation depth and
 * for how many people a household covers, never for how much the user records.
 * There are therefore no row counters in this file, and there should never be
 * one added. A cap on recorded items would stop free users experiencing the
 * product, which is the thing that earns the subscription.
 */

export type Plan = "free" | "plus" | "family";

/**
 * A named permission rather than a count, for the reasons above: a counter has
 * to be tripped over to have any effect, which punishes the engaged users worth
 * converting, and it fails open in the worst way by blocking the core loop.
 */
export type Capability =
  /** Recording a responsibility of any kind. Free, and never gated. */
  | "record.things"
  | "record.reminders"
  | "record.documents"
  /**
   * The answer to "is anything about to become a problem?". This is the product
   * thesis, so it stays in the free tier permanently. Premium widens the horizon
   * and the breadth around it (see alerts.recurrenceAware and friends); it never
   * switches this off. buildAlerts in lib/risk.ts runs for everyone.
   */
  | "alerts.overdue"
  | "alerts.fixedDate"
  /** Premium: alerts that need recurrence or service intervals to compute. */
  | "alerts.recurrenceAware"
  | "alerts.serviceInterval"
  /** How far ahead the alert scan looks. Free sees 30 days, paid sees 180. */
  | "alerts.horizon.180d"
  | "recurrence.custom"
  | "categories.custom"
  | "insights.summary"
  | "sync.crossDevice"
  | "backup.export"
  /**
   * Household support. Greenfield: HouseholdMember has types, an IndexedDB store
   * and seed data in lib/db.ts, and no component reads getAllMembers yet. The
   * Family tier gates work that has not been built.
   */
  | "household.members"
  | "household.sharedResponsibilities"
  | "household.roles";

/**
 * Every capability, in the order they are presented to the user. Anything
 * granted to a plan must appear here, and tests/modules.test.ts asserts that
 * each one is granted by at least one plan.
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
  "record.things",
  "record.reminders",
  "record.documents",
  "alerts.overdue",
  "alerts.fixedDate",
  "alerts.recurrenceAware",
  "alerts.serviceInterval",
  "alerts.horizon.180d",
  "recurrence.custom",
  "categories.custom",
  "insights.summary",
  "sync.crossDevice",
  "backup.export",
  "household.members",
  "household.sharedResponsibilities",
  "household.roles",
];

/**
 * Capabilities every plan grants. Held separately from the per-plan lists so
 * that a future plan edit cannot quietly drop a free capability, which would be
 * the single most damaging change possible to this file: it would withhold the
 * insight from the people who have not paid yet.
 */
const ALWAYS: readonly Capability[] = [
  "record.things",
  "record.reminders",
  "record.documents",
  "alerts.overdue",
  "alerts.fixedDate",
];

const PLUS: readonly Capability[] = [
  "alerts.recurrenceAware",
  "alerts.serviceInterval",
  "alerts.horizon.180d",
  "recurrence.custom",
  "categories.custom",
  "insights.summary",
  "sync.crossDevice",
  "backup.export",
];

const FAMILY: readonly Capability[] = [
  "household.members",
  "household.sharedResponsibilities",
  "household.roles",
];

const GRANTS: Record<Plan, readonly Capability[]> = {
  free: ALWAYS,
  // Family is additive over Plus: paying for household management should not
  // also lose you the automation depth, and bundling was left as an open product
  // decision. Revisit if Family ever stops including Plus.
  plus: [...ALWAYS, ...PLUS],
  family: [...ALWAYS, ...PLUS, ...FAMILY],
};

export const PLANS: readonly Plan[] = ["free", "plus", "family"];

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && (PLANS as readonly string[]).includes(value);
}

/**
 * How far ahead this plan's alert scan looks. Not a capability, because the
 * horizon is a magnitude rather than a permission, and lib/risk.ts needs a
 * number.
 */
const ALERT_HORIZON_DAYS: Record<Plan, number> = {
  free: 30,
  plus: 180,
  family: 180,
};

export function alertHorizonDays(plan: Plan): number {
  return ALERT_HORIZON_DAYS[plan];
}

/** True when the plan grants the capability. */
export function can(plan: Plan, capability: Capability): boolean {
  return GRANTS[plan].includes(capability);
}

/**
 * The capabilities added by moving up from `plan`, which is what an upgrade
 * screen should describe. An empty result means they are already on the best
 * tier, so the caller should not offer an upgrade to the same plan.
 */
export function upgradeDelta(plan: Plan): Capability[] {
  if (plan === "family") return [];
  const target: Plan = plan === "free" ? "plus" : "family";
  return GRANTS[target].filter((c) => !GRANTS[plan].includes(c));
}

/**
 * The tier above the given one, or null at the top. Keeping the ladder in one
 * place stops the upgrade screen and the checkout request disagreeing about
 * which plan comes next.
 */
export function nextPlan(plan: Plan): Plan | null {
  if (plan === "free") return "plus";
  if (plan === "plus") return "family";
  return null;
}

/* -------------------------------------------------------------------------
 * Pricing
 *
 * Deliberately not final. These are a hypothesis to be tested, kept in one place
 * so that no amount is hardcoded in a component and no paywall copy can state a
 * number that disagrees with this config.
 *
 * Amounts are in kobo, the smallest unit Paystack expects. Storing them in kobo
 * rather than naira removes the rounding question from every call site: there is
 * no conversion step to get wrong, because there is no conversion at all.
 * ------------------------------------------------------------------------- */

export type Interval = "monthly" | "yearly";

export interface Price {
  /** Minor units. 150000 kobo is ₦1,500. */
  amountKobo: number;
  currency: "NGN";
  interval: Interval;
}

/**
 * A working hypothesis, not a decision. ₦1,500-2,500/month and ₦12,000-18,000
 * per year were the starting range to test.
 *
 * Annual is priced at eight months for twelve, which is a conventional discount
 * and a deliberate one: annual is the plan that survives a lapsed card, which
 * matters when the only renewable methods are card and direct debit.
 */
export const PRICING: Record<Exclude<Plan, "free">, Record<Interval, Price>> = {
  plus: {
    // ₦1,500 and ₦12,000.
    monthly: { amountKobo: 1_500_000, currency: "NGN", interval: "monthly" },
    yearly: { amountKobo: 12_000_000, currency: "NGN", interval: "yearly" },
  },
  family: {
    // ₦2,500 and ₦18,000.
    monthly: { amountKobo: 2_500_000, currency: "NGN", interval: "monthly" },
    yearly: { amountKobo: 18_000_000, currency: "NGN", interval: "yearly" },
  },
};

export function priceFor(plan: Exclude<Plan, "free">, interval: Interval): Price {
  return PRICING[plan][interval];
}

/**
 * Trial length in days. A tunable constant rather than a hardcoded number
 * because it is the cheapest thing to change and among the first worth changing:
 * it is a pure product variable with no migration and no data consequence.
 *
 * 14 days is the current default. Treat it as a hypothesis for the same reason
 * the prices are.
 */
export const TRIAL_DAYS = 14;

/**
 * Hours of continued access after a lapse is detected.
 *
 * This exists to separate "the card failed" from "the customer cancelled". A
 * failed retry must not degrade someone's app mid-month, and re-granting access
 * later is a support conversation, whereas withdrawing it early is a complaint.
 *
 * Hours rather than days on purpose. An earlier draft used a days field and set
 * it to 24, which silently granted a month of unpaid access after expiry.
 */
export const GRACE_HOURS = 24;
