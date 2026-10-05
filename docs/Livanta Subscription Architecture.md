# Livanta Subscription Architecture

Status: design agreed, not yet built.
Last updated alongside commit `6db4536`.

This document exists so the freemium model does not require restructuring later.
It fixes the decisions that are expensive to reverse: where entitlements live,
what the server surface is, and what is deliberately never paywalled.

It is not a PRD. It is the technical contract that a later PRD section can point
at, so the product document and the code cannot disagree about what Plus means.

---

## 1. Decisions already taken

| Decision | Choice | Why |
| --- | --- | --- |
| Hosting for billing | Netlify Functions sidecar | Keeps `output: "export"` and the static Netlify deploy untouched |
| What the free tier limits | Advanced capability, never row counts | A capped core loop stops users experiencing the product |
| Proactive alerts | Insight free forever, breadth is premium | The insight is the reason anyone looks at a paywall |
| Documentation | Markdown, reviewable in git | The existing PRD is a 393kb PDF with no source |

---

## 2. The structural problem, stated plainly

Livanta is a **pure static export**. `next.config` sets `output: "export"`,
Netlify publishes `out/`, and the app has no API routes and no server actions.

That means the current build **cannot** take a payment. Not "should be
refactored to" — cannot:

- Paystack's **secret key** can create charges against the merchant account. It
  must never be present in a browser. A static bundle is public by definition.
- Paystack confirms payments by **POSTing to an HTTPS webhook**. Verifying that
  request's HMAC signature requires the secret key, so it requires a server.
- Recurring plans are managed server-side. The browser cannot cancel or query
  the subscription schedule.

So billing needs a server. The sidecar is deliberately small and separate from
the app: the static build stays a static build, and only three small functions
exist.

The app must remain fully usable with that sidecar absent or down. A user on a
plane, or a user whose function is cold-starting, must not see a broken app.

---

## 3. Principles: what Livanta will never charge for

These are product rules, not suggestions. If a proposed tier boundary violates
one, the boundary is wrong.

1. **Remembering is free.** Recording a responsibility and being reminded about
   it is the product's reason to exist. No cap on things, reminders, or
   documents in rows. This directly contradicts the original "limited number of
   things" / "unlimited reminders" split, which charged for the act of
   remembering.
2. **The insight is free.** The answer to *"is anything about to become a
   problem?"* is never paywalled. Overdue and fixed-date warnings stay in the
   free tier permanently.
3. **Never gate access to existing data.** Lapsing must not hide, delete, or
   refuse to render a thing the user already created. Losing sight of your own
   records because a card expired is the fastest route to refunds and to a
   one-star review. Premium controls *new capability*, never *old content*.
4. **Free must be able to demonstrate the value.** A free tier that cannot show
   the product working will not convert, because the user never learns what they
   are missing.

---

## 4. Tier model

Three tiers. Entitlements are expressed as **named capabilities**, not counters.

Counters were rejected deliberately. A counter means the free tier is defined by
a number the user has to trip over, which is the shape that produces resentment,
and it punishes exactly the engaged users worth converting.

```ts
export type Plan = "free" | "plus" | "family";

export type Capability =
  // Free forever. Listed explicitly so a future edit cannot quietly move them.
  | "record.things"
  | "record.reminders"
  | "record.documents"
  | "alerts.overdue"
  | "alerts.fixedDate"
  // Plus: automation depth and reach.
  | "alerts.recurrenceAware"
  | "alerts.serviceInterval"
  | "alerts.horizon.180d"
  | "recurrence.custom"
  | "categories.custom"
  | "insights.summary"
  | "sync.crossDevice"
  | "backup.export"
  // Family: more than one person.
  | "household.members"
  | "household.sharedResponsibilities"
  | "household.roles";
```

| Capability area | Free | Plus | Family |
| --- | --- | --- | --- |
| Things, reminders, document rows | Unlimited | Unlimited | Unlimited |
| Overdue + fixed-date alerts | Yes | Yes | Yes |
| Recurrence-aware and service-interval alerts | — | Yes | Yes |
| Alert horizon | 30 days | 180 days | 180 days |
| Custom recurrence and custom categories | — | Yes | Yes |
| "What needs attention" summary | — | Yes | Yes |
| Cross-device sync and backup | — | Yes | Yes |
| Household members and roles | — | — | Yes |
| Shared responsibilities | — | — | Yes |

Note what is absent: no row limits, anywhere. See §3.

---

## 5. Where entitlements live

**Not** in IndexedDB, deliberately.

`lib/db.ts` defines `DB_NAME = "lifedesk"`, `DB_VERSION = 2` and the stores
`things`, `alerts`, `members`, `settings`. Entitlements are a cache of server
truth, not user data, and they must be revocable. Putting a paid entitlement in
the same store as the user's own records would mean a revoked subscription has to
be reconciled against offline-cached data, and it would require a version 3
migration for something that is not really data.

Layering, in order of authority:

1. **Server (Supabase).** Authoritative. Written only by the verified Paystack
   webhook.
2. **`localStorage` cache.** Mirrors the server, with the expiry timestamp the
   server supplies. This is what an offline or first-load client reads.
3. **Build-time absence.** With no Supabase configured, the app resolves every
   user to `free` and cloud features stay unavailable, which is today's
   behaviour.

### Fail-open, with a grace window

If the cache is stale or the server is unreachable, the client resolves to the
**last known plan**, not to free. Locking someone out of their own data because
their card lapsed while they were offline is unacceptable, and rule 3 forbids it
anyway.

A lapsed plan degrades when the client next *can* reach the server: new
capabilities stop, existing data stays fully readable and editable. The UI must
state this in plain words rather than presenting it as a failure.

### Grace period

A short grace window (24h recommended) separates "card failed" from "cancelled",
so a failed retry does not degrade the user's experience mid-month. Tunable; see
§8.

---

## 6. Server surface

Three functions under `netlify/functions/`. Nothing else about the deploy
changes; `netlify.toml` keeps publishing `out/`.

| Function | Responsibility |
| --- | --- |
| `create-checkout` | Creates or reuses the Paystack plan and returns a checkout authorization URL. The only function that talks to Paystack's API from a request. |
| `paystack-webhook` | Verifies the `x-paystack-signature` HMAC against the raw body, then writes the entitlement to Supabase. Idempotent on event id. |
| `cancel-subscription` | Disables auto-renew at the period end. Access continues until then. |

Two rules make this surface trustworthy:

- **The webhook must verify against the raw request body.** Re-serializing the
  JSON to check the signature will fail or, worse, pass by accident. Read the
  body as a buffer once, verify, then parse.
- **Webhook handlers must be idempotent.** Paystack retries. Applying the same
  event twice must not corrupt state, so key on the event id and ignore
  replays.

### A note on Netlify's free tier

Function invocations are metered. `paystack-webhook` only runs on real payment
events, so volume tracks paying customers, not traffic. `create-checkout` runs
only on an explicit user action. This is not a cost concern at launch scale, but
it is a reason not to put anything chatty or high-traffic in a function.

---

## 7. Payment flow, and the Paystack constraint that shapes it

**Paystack's Nigerian USSD and Pay-with-Bank methods do not support recurring
charges.** A subscription can only renew through a method that supports a
standing mandate: card, or bank direct debit.

Therefore the subscription checkout must **only present renewable methods**. A
USSD option in the subscribe flow is a trap: the first payment succeeds and every
renewal after it fails, which surfaces as a cancellation the user did not choose.

Consequences to design around from the start:

- Method selection belongs to the subscription flow, not to a generic payment
  picker. Do not build one picker and let it offer everything.
- Store the chosen mandate reference, so renewal failure is distinguishable from
  voluntary cancellation.
- Renewal failure needs its own user-facing state, distinct from cancel. They
  look identical in the webhook unless the subscription code is recorded.

### Sequence

1. Client calls `create-checkout` with the desired plan and interval.
2. Function returns a Paystack authorization URL; client redirects.
3. Paystack collects the card or direct-debit mandate.
4. Paystack POSTs events to `paystack-webhook` (subscription create, charge
   success, charge failure, subscription disable).
5. Webhook verifies HMAC, writes entitlement plus expiry to Supabase.
6. Client reads entitlement from its cache, or revalidates via Supabase.

The browser never holds the secret key and never decides its own plan.

---

## 8. Pricing as configuration

Pricing is explicitly **not being locked in**. It is to be tested.

Both prices and the trial length live in one module and are read from there.
Nothing may hardcode an amount in a component, and no paywall copy may state a
number that is not derived from that config.

Working hypothesis, to be tested rather than trusted:

- Free
- Livanta Plus — 14 or 30 day trial, then ₦1,500–₦2,500/month
- Livanta Plus annual — ₦12,000–₦18,000/year

Two cautions on the supporting data: the trial-conversion figures in circulation
are global cross-app subscription averages, not a Livanta forecast, and the
range is an assumption to test. Trial length in particular should be a tunable
constant, because it is the cheapest thing to change and among the first things
worth changing.

Paystack amounts are in the smallest currency unit, so kobo. The config must
convert, and that conversion should be centralised rather than done per call
site.

---

## 9. Security boundaries

- `PAYSTACK_SECRET_KEY` is **server-only**. It must not be prefixed
  `NEXT_PUBLIC_`, and `.env.example` already warns that `NEXT_PUBLIC_` values
  ship inside the bundled JavaScript.
- The anon Supabase key is designed to be public and may be exposed. The
  service-role key must never appear in a function that logs, or in any
  response body.
- Entitlements must be readable and writable through **Supabase RLS only**. A
  client that can update its own `plan` column can grant itself Plus. The user
  row's plan is server-written and client-read-only; the policy in the existing
  `supabase/migrations/` is where this belongs.
- The client must treat its cached plan as a hint, not authority. It is fine for
  deciding which UI to show; it is never fine for deciding what the server will
  honour.

---

## 10. Where this touches existing code

Integration points, all identified against the current tree:

| File | Change |
| --- | --- |
| `lib/plans.ts` | **New.** `Plan`, `Capability`, the capability table, and pricing config. No imports, no I/O. |
| `lib/entitlements.ts` | **New.** Resolves capabilities from cache plus server, with the fail-open rule from §5. |
| `components/screens/ProfileScreen.tsx:77` | Already renders a hardcoded `t("profile.freePlan")`. This becomes the plan and upgrade entry point. The only existing UI seam. |
| `lib/supabase/client.ts` | No change to `isCloudEnabled()`. Entitlements resolve to free without cloud config, which is why this stays as it is. |
| `lib/db.ts` | **No change.** Version stays 2, stores stay `things`, `alerts`, `members`, `settings`. |
| `lib/locales/{en,ha,yo,ig}.ts` | Every new user-facing string, including plan names and paywall copy. All four catalogues, kept in step. |

Two things that look like they should change but must not:

- **`lib/risk.ts` stays free.** `buildAlerts` keeps producing `overdue`,
  `expiring`, `recurring-due`, `service-overdue` and `no-record` for everyone.
  Premium adds horizon and breadth around it, it does not switch it off.
- **`HouseholdMember` is dormant.** `getAllMembers` and `putMember` exist in
  `lib/db.ts` with seed data, and **no component reads them**. The Family tier is
  a greenfield feature, not a gate over existing work.

---

## 11. Scope warning on "unlimited documents"

`document` and `asset` are `ThingKind` values, and there is **no file storage in
the app** — no `FileReader`, no upload, no blob handling anywhere outside
notification export.

So "unlimited documents" today means unlimited *rows* tracking a document, not
unlimited scanned copies of a passport. If document storage is intended as a paid
feature, it is a separate build: blob storage, a Supabase Storage bucket, RLS, and
lifecycle for superseded scans. That is a materially larger project than the
entitlement layer, and should not be implied by a pricing page.

---

## 12. Verification plan

The app currently has 257 tests, and `scripts/responsive-qa.mjs` audits five
viewports. Billing adds to both.

- **Unit.** Capability table completeness: every `Capability` is granted by at
  least one plan and by no plan it should not be. Pricing config converts to
  kobo correctly. Entitlements resolve open when the cache is stale.
- **Signature.** Webhook HMAC verification accepts a genuine signature and
  rejects a tampered body. A replayed event id is ignored. This is the single
  most security-critical test in the project.
- **RLS.** A signed-in client cannot write its own plan. Asserted directly
  against the policy, not through the UI.
- **Paystack method constraint.** A test asserting the subscription flow never
  presents a non-renewable method, so nobody reintroduces USSD into checkout.
- **Fail-open.** Lapsing with no network leaves existing data readable.
- **Responsive.** Paywall and plan surfaces re-run through the existing audit;
  the pricing screen is a new screen and inherits the 44px and no-overflow rules.
- **i18n.** A test asserting every new key exists in all four catalogues, matching
  the existing parity test in `tests/account.test.tsx`.

---

## 13. Open items

Not decided, and each is a real decision rather than a detail:

- **Family tier scope.** Whether it is one shared household or genuinely
  multi-user with roles and conflict resolution. The second is a much larger
  product and changes the sync model in `lib/useCloudSync.ts`.
- **Trial length**, 14 versus 30 days.
- **Whether Family bundles Plus**, or is strictly additive.
- **What happens to Plus on lapse.** Recommendation: access continues to period
  end, then degrades to free, and data is never withheld (rule 3).
- **Refund and chargeback handling** for Nigerian card disputes.
- **Whether the dormant `members` store is the right shape**, given it was never
  wired to a UI.
