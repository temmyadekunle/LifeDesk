/**
 * Sample data for the landing page phone mockups.
 *
 * These are the REAL app's data and the REAL components that render it. Every
 * screen in a mockup is produced by passing this through the same HomeScreen,
 * ThingsScreen and so on that the live app uses, so the page cannot drift from
 * the product the way a hand-written fake would.
 *
 * The one thing that cannot be reused is the `desk` object, which normally comes
 * from useLivanta and needs IndexedDB. This builds an equivalent object instead,
 * which is what makes the screens renderable at all during a static export.
 *
 * WHY THIS TAKES A `now`
 *
 * The landing page is statically generated: the HTML is written once, at build
 * time, and then served to readers on any date and in any timezone. Anything
 * that reads the clock while rendering would therefore print one answer into the
 * HTML and a different one when the browser hydrated it, and React treats that
 * as a hydration mismatch and throws the server HTML away.
 *
 * So every mockup is built from a single `now` that the server passes down as a
 * prop. Server render and client render then compute from the same instant and
 * cannot disagree. The dates in the mockups are relative to that instant, so
 * they read correctly on the day the site is deployed; refresh them by shipping
 * a new build, the same way any copy change would be refreshed.
 */
import { buildAlerts, derivePriority, utcDaysUntil, type DayDiff } from "@/lib/risk";
import { makeT } from "@/lib/i18n";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { amountOrZero } from "@/lib/money";
import type { Alert, Category, Priority, Thing, ThingKind } from "@/lib/types";

/** Calendar-day arithmetic in UTC, so the result cannot depend on the builder's
 *  timezone. `daysUntil` in lib/risk does this in local time, which is right for
 *  a live app and irrelevant here: we only need the strings to be stable. */
function isoFrom(now: Date, days: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
  return d.toISOString().slice(0, 10);
}

function pastFrom(now: Date, daysAgo: number): string {
  return isoFrom(now, -daysAgo);
}

interface SeedSpec {
  name: string;
  category: Category;
  kind: ThingKind;
  amount?: number | null;
  dueIn?: number;
  lastHandledDaysAgo?: number;
  recurrence?: Thing["recurrence"];
  serviceIntervalDays?: number | null;
  notes?: string | null;
  details?: Record<string, unknown>;
}

/**
 * A smaller, deliberate set than lib/seed.ts. The landing page has room for a
 * handful of rows, and every extra one makes the mockup less like the real
 * screen. The offsets reproduce a genuine mix of tones: something urgent,
 * something next week, something further out, and two service items with no
 * fixed date, which is the state that makes the Home screen worth looking at.
 */
const SHOWCASE: SeedSpec[] = [
  {
    name: "Electricity",
    category: "money",
    kind: "utility",
    amount: 45_200,
    dueIn: 2,
    recurrence: { frequency: "monthly", interval: 1 },
    details: { provider: "Ikeja Electric" },
  },
  {
    name: "Netflix",
    category: "money",
    kind: "subscription",
    amount: 8_500,
    dueIn: 6,
    recurrence: { frequency: "monthly", interval: 1 },
    details: { provider: "Netflix" },
  },
  {
    name: "Mum's birthday",
    category: "family",
    kind: "birthday",
    dueIn: 6,
    details: { contact: "Mum" },
  },
  {
    name: "Vehicle insurance",
    category: "transport",
    kind: "insurance",
    amount: 85_000,
    dueIn: 12,
    recurrence: { frequency: "annual", interval: 1 },
    details: { vehicle: "Toyota Camry", plateNumber: "ABC-123-LAG" },
  },
  {
    name: "Rent",
    category: "home",
    kind: "rent",
    amount: 1_200_000,
    dueIn: 18,
    recurrence: { frequency: "annual", interval: 1 },
    notes: "Pay before the 25th to avoid a late fee.",
    details: { landlord: "Mr. Okonkwo" },
  },
  {
    name: "Driver's licence",
    category: "documents",
    kind: "document",
    dueIn: 45,
    details: { issuer: "FRSC", licenceNumber: "NG-8821-L" },
  },
  {
    name: "Passport",
    category: "documents",
    kind: "document",
    dueIn: 120,
    details: { issuer: "NIS", passportNumber: "A0981234" },
  },
  {
    name: "Car service",
    category: "transport",
    kind: "maintenance",
    amount: 30_000,
    lastHandledDaysAgo: 95,
    serviceIntervalDays: 90,
    notes: "Last serviced 3 months ago.",
    details: { vehicle: "Toyota Camry" },
  },
  {
    name: "Generator service",
    category: "home",
    kind: "maintenance",
    amount: 45_000,
    lastHandledDaysAgo: 120,
    serviceIntervalDays: 90,
    details: { asset: "Generator", provider: "Emeka" },
  },
  {
    name: "School fees",
    category: "family",
    kind: "school-fee",
    amount: 150_000,
    dueIn: 14,
    recurrence: { frequency: "biannual", interval: 1 },
    details: { child: "Chidi", school: "Command Primary" },
  },
  {
    name: "John the electrician",
    category: "services",
    kind: "service-provider",
    lastHandledDaysAgo: 45,
    notes: "Reliable, fixes fast.",
    details: { trade: "Electrician", phone: "08000000001", rating: 5 },
  },
];

function toThing(spec: SeedSpec, index: number, now: Date): Thing {
  const stamp = now.toISOString();
  const thing: Thing = {
    id: `showcase-${index}-${spec.kind}`,
    name: spec.name,
    category: spec.category,
    kind: spec.kind,
    amount: spec.amount ?? null,
    currency: "NGN",
    dueDate: spec.dueIn === undefined ? null : isoFrom(now, spec.dueIn),
    lastHandledDate:
      spec.lastHandledDaysAgo === undefined
        ? null
        : pastFrom(now, spec.lastHandledDaysAgo),
    recurrence: spec.recurrence ?? null,
    serviceIntervalDays: spec.serviceIntervalDays ?? null,
    status: "active",
    priority: "routine",
    notes: spec.notes ?? null,
    details: spec.details ?? {},
    createdAt: stamp,
    updatedAt: stamp,
  };
  thing.priority = derivePriority(thing, now, utcDaysUntil);
  return thing;
}

const HORIZON = 30;

function buildStatus(things: Thing[], now: Date) {
  const active = things.filter((x) => x.status === "active");
  const byPriority = (p: Priority) => active.filter((x) => x.priority === p).length;
  const urgentCount = byPriority("urgent");
  const importantCount = byPriority("important");
  const onTrackCount = byPriority("upcoming") + byPriority("routine");

  const level =
    urgentCount > 0
      ? "immediate"
      : importantCount > 0
        ? "needs-attention"
        : "stable";
  const label =
    urgentCount > 0
      ? "Needs attention now"
      : importantCount > 0
        ? "Needs attention"
        : "On track";

  const headline =
    urgentCount > 0
      ? `${urgentCount} thing${urgentCount === 1 ? "" : "s"} need${
          urgentCount === 1 ? "s" : ""
        } you now.`
      : importantCount > 0
        ? `${importantCount} coming up soon.`
        : "Nothing urgent. You're on track.";

  void now;
  return { urgentCount, importantCount, onTrackCount, level, label, headline };
}

export interface Showcase {
  now: Date;
  /** The day-count every mockup must use, so nothing depends on a timezone. */
  dayDiff: DayDiff;
  things: Thing[];
  alerts: Alert[];
  desk: ReturnType<typeof makeDesk>;
}

function makeDesk(now: Date, things: Thing[], alerts: Alert[]) {
  const t = makeT("en");

  /* Today, at UTC midnight, so "days until" is the same number for everyone.
     Computed once because it does not move while this runs. */
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const upcoming = things
    .filter((x) => {
      if (x.status !== "active" || !x.dueDate) return false;
      /* The Z is not decoration. Without it this parses as midnight on the
         *visitor's* clock while `start` is UTC midnight, so the horizon check
         below shifts by their UTC offset: a thing due today reads as -1 and
         drops out of the list east of Greenwich, and one due on the horizon
         edge drops out west of it. Nothing in the sample data sits near either
         boundary, so this is a latent trap rather than a visible bug today --
         but the wording the reader sees comes from utcDaysUntil, and a filter
         that disagreed with it would be a hydration mismatch the moment the
         sample dates moved. */
      const target = Date.parse(`${x.dueDate}T00:00:00`);
      const days = Math.round((target - start) / 86_400_000);
      return days >= 0 && days <= HORIZON;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  return {
    loading: false,
    ready: true,
    error: null,
    things,
    alerts,
    status: buildStatus(things, now),
    totals: {
      total: upcoming.reduce((sum, x) => sum + amountOrZero(x.amount), 0),
      count: upcoming.length,
      items: upcoming,
    },
    settings: { ...DEFAULT_SETTINGS, onboarded: true, displayName: "Temmy" },
    t,
    // No-ops: a visitor tapping a mockup must not be able to change anything,
    // and nothing here is persisted regardless.
    refresh: async () => {},
    updateSettings: async () => {},
    completeOnboarding: async () => {},
    loadSampleData: async () => {},
    deleteEverything: async () => {},
    addThing: async () => undefined,
    completeThing: async () => undefined,
    dismissAlert: async () => {},
    restoreAlerts: async () => {},
    updateThing: async () => undefined,
    removeThing: async () => {},
    byCategory: () => [],
    formatNaira: (n: number | null) =>
      n === null ? "" : `₦${n.toLocaleString("en-NG")}`,
  } as unknown as ReturnType<typeof import("@/lib/useLivanta").useLivanta>;
}

function build(now: Date): Showcase {
  const things = SHOWCASE.map((spec, i) => toThing(spec, i, now));
  const alerts = buildAlerts(things, now, makeT("en"), utcDaysUntil);
  return { now, dayDiff: utcDaysUntil, things, alerts, desk: makeDesk(now, things, alerts) };
}

/**
 * Memoised on the whole instant, so repeated renders in the same request reuse
 * one set of objects and React sees stable references. The cache holds a single
 * entry: a static page renders one clock, and holding more would be a leak.
 */
let cachedNow: number | null = null;
let cachedShowcase: Showcase | null = null;

export function makeShowcase(now: Date): Showcase {
  if (cachedShowcase && cachedNow === now.getTime()) return cachedShowcase;
  cachedNow = now.getTime();
  cachedShowcase = build(now);
  return cachedShowcase;
}
