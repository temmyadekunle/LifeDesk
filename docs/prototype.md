# Livanta — Mobile App Prototype & Product Presentation

**Prepared by Temitope Adekunle** · Version 0.1.0 · 9 October 2026  
**Positioning:** Your life, organized. Your problems, anticipated.  
**Splash line:** *Your life, organized.*  
**Live prototype:** https://livanta.folababy02.workers.dev · **Presentation route:** https://livanta.folababy02.workers.dev/prototype/

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [The problem](#2-the-problem)
3. [The product idea](#3-the-product-idea)
4. [Target users](#4-target-users)
5. [Positioning and voice](#5-positioning-and-voice)
6. [Feature inventory](#6-feature-inventory)
7. [Information architecture](#7-information-architecture)
8. [Screen inventory](#8-screen-inventory)
9. [Onboarding walkthrough](#9-onboarding-walkthrough)
10. [Demo data](#10-demo-data)
11. [Primary user flows](#11-primary-user-flows)
12. [Design system](#12-design-system)
13. [Localization](#13-localization)
14. [Platform and architecture](#14-platform-and-architecture)
15. [Privacy and trust](#15-privacy-and-trust)
16. [MVP, next, and future](#16-mvp-next-and-future)
17. [Live demo script (3–5 minutes)](#17-live-demo-script-35-minutes)
18. [Demo instructions](#18-demo-instructions)

---

## 1. Executive summary

Livanta is a local-first mobile app that keeps a household's responsibilities — rent, bills, documents, vehicles, school fees, warranties and service schedules — in one place, and warns the owner **before** each one becomes an emergency.

The prototype in this repository is a working product, not a mockup. It boots into a splash, runs a five-step onboarding, seeds a realistic Nigerian household with one tap ("Open with demo data"), and implements the full loop: add a thing → derive risk → receive an alert → act on it → mark it handled. It ships as an installable PWA on Cloudflare Workers and as a signed Android APK.

| | |
|---|---|
| **Prototype build** | v0.1.0 (versionCode 3) |
| **Navigation** | Home · Life · Alerts · Calendar · Profile |
| **Languages** | English · Hausa · Yoruba · Igbo |
| **Data** | On-device IndexedDB (`lifedesk`), optional account sync |
| **Quality gates** | 368 automated tests, browser smoke test, CSP check, 5-viewport responsive QA |
| **Screens captured** | 10 (rendered from this build at 390×844, shown on `/prototype`) |

---

## 2. The problem

Adults juggle obligations that arrive on scattered schedules: rent before the 25th, an electricity token top-up, a licence that expires at the FRSC, insurance that lapses quietly, a warranty that dies one week before the fridge breaks, a generator service that was "four months ago". In Nigeria these live in a mix of bank SMS, calendar reminders, memory, and paper in a drawer.

The failure mode is never "I didn't know". It is "I knew, but not on the day it mattered". Missed renewals cost money (late fees, lapsed cover, rush charges) and stress. General to-do apps don't help because they treat *renewing a driver's licence* and *buying milk* as the same kind of row. Spreadsheets die after two weeks. Calendars have no concept of a warranty period or a service interval.

---

## 3. The product idea

Livanta models the household as a set of **things** — each with a category, a kind (rent, utility, subscription, insurance, document, maintenance, asset, school fee, service provider…), an amount in naira, a due date or service interval, and a recurrence. From that single record it derives everything else:

- a **priority** (urgent / important / upcoming / routine) from today's date and the item's own rules,
- an **alert** list triaged into "needs attention", "coming up", "completed",
- a **status reading** for the home screen ("you're mostly on track" versus "1 thing needs attention now"),
- a **calendar** view and a due-soon roll-up for the next 30 days.

The user writes one honest record once; the app keeps watch after that. Everything is computed on the device, works offline, and syncs only if the user creates an account.

---

## 4. Target users

**Primary — the household manager.** Usually one person per home carries the mental load: the spouse who pays rent, tracks the generator man, renews the insurance and knows where the passports are. Age 25–45, smartphone-first, mid-to-high data cost sensitivity.

**Secondary — young professionals** with documents and subscriptions piling up (licence, passport, Netflix, gym, data plans) and no system.

**Tertiary — small families** coordinating school fees, appointments and shared vehicles across two adults (the household-member model ships in the data layer already; sharing comes next).

**Explicit non-goals:** children's records, medical data, and anything requiring a national ID or bank number — Livanta stores expiry *dates*, never the numbers that identify you.

---

## 5. Positioning and voice

> **Your life, organized. Your problems, anticipated.**

The voice is calm, competent, and non-judgemental — a well-organized friend, not an alarm system. Copy avoids "overdue!!!" panic and urgency badges; a bill due in one day is stated as a fact ("Electricity renews in 1 day") with a clear action ("Review"). Local references are first-class: naira amounts, Ikeja Electric, FRSC, NIS, Command Primary, a landlord named Mr. Okonkwo.

**What we do not claim:** we don't pay bills for you (yet), we don't file documents, and we don't promise you'll never miss anything. We promise you will *see it coming*.

---

## 6. Feature inventory

**Core (working in this prototype)**

- **Splash → shell:** branded splash with the slogan, then the tab shell.
- **Five-tab navigation:** Home, Life, Alerts, Calendar, Profile — bottom nav, always visible.
- **Home:** greeting hero, status headline, three-stat reading (urgent / important / on track), needs-attention card linking to Alerts, "coming soon" roll-up (next 30 days), quick-add, life-areas shortcut, total commitments.
- **Life:** the brief's hub — five life areas (Home, Vehicles, Bills, Documents, Assets) with live counts, the full searchable thing list with category and status filters, saved service providers with call/WhatsApp actions, and an inline quick add.
- **Alerts:** category filter chips, then three sections — *Needs attention* (alert cards with Dismiss / Review), *Coming up*, *Completed* — with quiet empty states.
- **Calendar:** month grid with due-day dots, agenda for the selected day, "upcoming" list.
- **Profile:** identity card, account/sign-in, security, language switch (4 languages), notification permission and reminder schedule, data export (JSON) and delete-all, Help & support, About, legal.
- **Add / edit:** quick-add sheet (name, category, kind, amount, date, recurrence) and a full editor; detail sheet with notes, details, mark-handled, edit, delete.
- **Modules:** drill-in lists for a single life area with its own header and counts.
- **Onboarding:** 5 steps (welcome + language, value props, choose areas, first thing, notifications) with skip paths and a demo shortcut.
- **Demo data:** one tap seeds the full household below.
- **PWA:** manifest, service worker, offline page, install prompt.
- **Android APK:** signed WebView wrapper (versionCode 3) distributed via GitHub Release.
- **Privacy:** local-first storage, no analytics, no cookies, no third-party requests, enforced CSP.

**Present in the data layer, not yet surfaced:** household members, plan/entitlement cache (free tier = whole app today), recurring-completion history.

---

## 7. Information architecture

```
Splash "Your life, organized."
 └ Onboarding (first run) ── or ── "Open with demo data"
    └ App shell
       ├ Home      — status, attention, coming soon, quick add, life areas
       ├ Life      — areas → modules · thing list · providers
       ├ Alerts    — filters · needs attention · coming up · completed
       ├ Calendar  — month grid · day agenda · upcoming
       └ Profile   — account, language, notifications, data, help, legal
          Stack:  Module drill-in · Sign-in
          Sheets: Quick add · Thing detail · Thing editor
```

**Nav decisions for this brief:** the original Things list became the **Life** hub; the old Services screen's providers moved into Life under their own section; the standalone Notifications screen became the **Alerts** tab, so triage is one tap from anywhere. The header on Life and Alerts carries the screen title, count and status so no second in-content title competes with it.

---

## 8. Screen inventory

Ten screens are captured from the running build (390×844 @2x) and shown on `/prototype`:

| # | File | Screen | What it demonstrates |
|---|------|--------|----------------------|
| 1 | `welcome.png` | Onboarding — welcome | Splash-adjacent first run, language picker (EN/HA/YO/IG), Get Started, sign-in path, **Open with demo data** |
| 2 | `value-prop.png` | Onboarding — value props | Brief's three headlines: *Know what needs your attention · Take action with confidence · Everything in one place* |
| 3 | `home.png` | Home tab | Status hero, urgent/important/on-track stats, needs attention, coming soon, quick add, life areas |
| 4 | `quick-add.png` | Quick-add sheet | Fast capture: name, category, kind, amount, date, recurrence |
| 5 | `life.png` | Life tab | Life areas with counts, search, category chips, status chips, providers |
| 6 | `detail.png` | Thing detail | Full record: amount, due date, notes, details, mark handled / edit / delete |
| 7 | `module-documents.png` | Module — Documents | Drill-in from a life area with module header |
| 8 | `alerts.png` | Alerts tab | Filter chips (All/Home/Vehicles/Bills/Documents/Family/Tasks/Services), Needs attention cards with Dismiss/Review, count + status in header |
| 9 | `calendar.png` | Calendar tab | Month grid with due-day dots, day agenda, upcoming |
| 10 | `profile.png` | Profile tab | Identity, account, language, notifications, data export, help, legal |

**Screens without a capture** (still reachable in the app): onboarding steps 3–5 (choose areas, first thing, notifications), the sign-in sheet, and every empty state (fresh install, all-clear, completed).

---

## 9. Onboarding walkthrough

1. **Welcome** — wordmark, *"Welcome to Livanta"*, the lead line about bills/documents/vehicles/family dates, language picker, **Get Started**, a quiet *I already have an account — Sign In*, and **Open with demo data** (the demo shortcut skips straight into a populated app — this is the demo route).
2. **Value props** — *"Stay ahead of everyday life."* with three cards folded in from the brief: **Know what needs your attention** (Livanta spots deadlines before they become urgent), **Take action with confidence** (track what matters, stay prepared), **Everything in one place** (bills, documents, vehicles, family dates, tasks — clearly organized).
3. **Choose what to manage** — the seven categories (Home, Transport, Money, Documents, Family, Tasks, Services); skippable.
4. **First thing** — *"Let's help you prevent problems."* add one item with example chips (Vehicle insurance, Electricity bill, Passport); skippable ("Skip and explore Livanta").
5. **Notifications** — *"Never miss an important date"* → Allow / Not Now; permission is optional and revocable.

Onboarding is resumable, fully translated, and never blocks the demo path.

---

## 10. Demo data

One household, seeded deterministically on first run of the demo (`lib/seed.ts`). Dates are relative to the day the demo is opened, so the story always reads correctly.

| Thing | Category / kind | Amount (₦) | Timing | Story beat |
|---|---|---:|---|---|
| Rent | home · rent | 1,200,000 | due in 18 days (annual) | the big one, "pay before the 25th"; landlord Mr. Okonkwo, service charge 150,000 |
| Electricity | money · utility | 45,200 | due in 1 day, monthly | Ikeja Electric — the urgent alert |
| Internet subscription | money · subscription | 20,000 | due in 3 days, monthly | Spectranet 10GB + 4G router |
| Netflix | money · subscription | 8,500 | due in 6 days, monthly | subscription creep |
| Vehicle insurance | transport · insurance | 85,000 | due in 12 days (annual) | Toyota Camry, ABC-123-Lagos |
| School fees | family · school-fee | 150,000 | due in 14 days, biannual | Command Primary, assigned to Partner |
| Driver's licence | documents · document | — | expires in 45 days | FRSC renewal |
| Passport | documents · document | — | expires in 240 days | NIS — long-horizon item |
| LG Refrigerator | home · asset | 465,000 | warranty expires in 21 days | warranty lapsing (bought 344 days ago) |
| Generator service | home · maintenance | 45,000 | every 90 days, last serviced 120 days ago | interval-based, already overdue |
| Toyota Camry oil change | transport · maintenance | 30,000 | every 120 days, last done 200 days ago | interval-based, overdue |
| John the electrician | services · provider | — | called 45 days ago | saved provider with rating and phone |

Household: **Temmy Adekunle** (owner). Currency: NGN throughout. Alerts derive from this data — **9 alerts** at seed time, with Electricity/Netflix/Internet urgent and the rest important/upcoming. The generator and oil-change intervals make the "coming soon / needs attention" story richer than dates alone.

---

## 11. Primary user flows

**A. First open → demo (the presentation path)**  
Splash → welcome → **Open with demo data** → Home with a populated status. (0–15 seconds.)

**B. Triage the morning**  
Home shows *"1 thing needs attention now."* → tap **Review** / *See all* → Alerts → read *Electricity renews in 1 day* → tap **Review** → detail sheet → *Mark handled* → card leaves Needs attention → status reading updates.

**C. Filter the noise**  
Alerts → tap **Bills** chip → only money-category alerts remain → **All** restores. Sections keep the triage order: needs attention, coming up, completed (restorable).

**D. Add something before you forget it**  
Any tab → **+** (floating) → Quick add → *Name, category, kind, amount, date, recurrence* → saved → appears in Life list, Calendar and (when it gets close) Alerts.

**E. Browse life as a hub**  
Home → *Life areas* link (or Life tab) → areas with counts → tap **Documents** → module screen (2 items) → tap **Passport** → detail → edit or mark handled. Back returns to where you were.

**F. Call the plumber**  
Life → *Trusted providers* → **John the electrician** → Call / WhatsApp actions from the provider card.

**G. Plan the month**  
Home → *Coming soon* → Calendar → month grid with dots on due days → tap a day → agenda → upcoming list below.

**H. Trust check**  
Profile → Language → switch to **Hausa** → whole app re-renders in Hausa → switch back → *Export my data* downloads JSON → *Delete all my data* clears the device (confirmation required).

---

## 12. Design system

- **Palette:** navy ink on a cool off-white surface, with category accents — home (teal), transport (blue), money (green), documents (purple), family (orange), tasks (pink), services (ochre); urgency uses a restrained red only where action is needed. Tokens live in `app/globals.css` (`--ink-*`, `--home`, `--money`, …) and are mirrored in the manifest theme color.
- **Type:** system-first stack, tight tracking on large numerals, tabular-feel headings; sentence case everywhere except tiny meta labels.
- **Components:** cards with soft borders and 14–16 px radii, pill chips for filters, section headers with a right-hand text link, bottom sheets for capture/detail, a 56 px floating add button, skeleton shimmer for code-split screens.
- **Motion:** short, functional transitions (splash pop-fade, sheet slide); respects reduced-motion.
- **Phone-frame presentation:** the marketing site renders the same screens inside a phone bezel (`components/landing/PhoneFrame.tsx`) so the landing page and the app never drift apart.

---

## 13. Localization

Four locales ship with full key parity, placeholder parity, and genuine translations (en · ha · yo · ig) — enforced by tests, not by good intentions. Locale affects greeting, all copy, date/number formatting and plural rules. Switchable at onboarding and any time in Profile. The presentation, however, stays in English.

---

## 14. Platform and architecture

```
Next.js 15 (App Router, output: "export")
 ├─ app/            landing, privacy, terms, translations, prototype (this presentation)
 ├─ components/     LivantaApp shell + screens + sheets
 ├─ lib/            things, risk/derivePriority, buildAlerts, IndexedDB (lifedesk), locales
 └─ public/         sw.js, manifest, offline.html, prototype/*.png
        │ npm run build  → out/
        ▼
Cloudflare Workers (wrangler deploy)  ── live site + PWA + CSP headers
Android WebView wrapper (build-android.ps1) ── signed APK → GitHub Release
```

- **Storage:** IndexedDB `lifedesk` with stores `things`, `alerts`, `members`, `settings`; subscription state in `localStorage` (`livanta.entitlement.v1`). No server round-trip in the core loop.
- **Offline:** service worker caches the shell; `offline.html` as fallback; every feature works with the network off.
- **Code-splitting:** Home, shell and sheets load eagerly; Life, Alerts, Calendar, Profile and module screens are dynamic chunks fetched on navigation, then served from cache.
- **Quality gates (all green):** `npm run typecheck`, `npm run lint`, `npm test` (368 tests: logic, i18n parity, rendering), `npm run smoke` (Playwright boots the export, walks every tab, asserts 0 page/console errors and 0 failed requests), `npm run check:csp` (CSP delivered and enforced), `npm run qa:responsive` (5 viewports, 0 findings).
- **Distribution:** web (Workers) · installable PWA · Android APK `livanta-0.1.0-release.apk` (v0.1.0, versionCode 3) on the GitHub Releases page.

---

## 15. Privacy and trust

- Everything stays on the device unless the user deliberately signs in (optional Supabase sync).
- No analytics, no cookies, no third-party fonts/scripts/images — enforced by a Content-Security-Policy that only allows Livanta's own origins (verified by `check:csp`).
- Never asks for NIN, passport number, bank details or location. Free-text notes are the user's responsibility and the privacy copy says so plainly.
- Notifications are scheduled locally; reminder text never reaches us.
- Export to JSON and delete-all are in the app itself, not behind support email.
- Draft privacy policy and terms ship alongside the app (clearly marked as drafts pending legal review).

---

## 16. MVP, next, and future

| Layer | Scope | Status |
|---|---|---|
| **MVP — this prototype (v0.1)** | Local-first thing/alert/calendar/life hub · quick add + detail + edit · derived priorities · 5-tab shell with splash · 5-step onboarding + demo mode · 4 languages · seeded Nigerian demo household · providers with call/WhatsApp · JSON export + delete-all · PWA offline install · Android APK · CSP + no-tracking privacy | **Shipped** (tests, smoke, CSP, responsive QA green) |
| **Next (v0.2–0.3)** | Optional accounts + sync across devices (Supabase, fail-open entitlement cache already built) · recurring "mark handled → next occurrence" flow surfaced end-to-end · household members shared (data model present: owner/partner roles) · push/email reminder channels beyond the Notifications API · Play Store / App Store listings (landing already says "coming soon") · alert snooze/custom rules · richer calendar (month recurrence preview) · on-device document photos as attachments | Designed, partially in data layer |
| **Future (v1.x)** | Payment rails (Paystack integration ready in docs, not enabled in beta) with a paid tier funded by the free plan staying free · predictive anticipation ("your diesel spend usually jumps in December") · warranty claims helpers · OS widgets (today's due items) · iOS build · provider marketplace ratings beyond personal contacts · OCR for expiry dates (dates only, never ID numbers) · shared family calendar feed | Concept |

**Sequencing principle:** ship trust first (local, private, exportable), sync second (only as opt-in), money third (never by carving up the free tier after people depend on it).

---

## 17. Live demo script (3–5 minutes)

**Setup:** open https://livanta.folababy02.workers.dev (or the APK). Start on the splash.

1. **Hook (20 s).** *"Everyone has a month where rent, an electricity bill and a licence renewal all land in the same week. Livanta is the app that sees that week coming."* Show the splash line: *Your life, organized.*
2. **Demo in one tap (20 s).** On welcome, tap **Open with demo data** — *"This is a full household, seeded with realistic Nigerian data."* Land on Home. Point at the status reading and the three stats (urgent / important / on track).
3. **The alert loop (60 s).** *"Home says one thing needs attention now."* Tap into **Alerts**: nine alerts, filter chips. *"Electricity renews in one day."* Open it, show the record (₦45,200, Ikeja Electric), **Mark handled** — the card leaves Needs attention and the counts update. *"That's the whole loop: it saw it, told me, I acted, it's gone."*
4. **Life as a hub (60 s).** Go to **Life**: five areas with live counts — *"Not categories you have to maintain; they're views onto what you already entered."* Search, filter, open **Documents → Passport** detail. Show providers: *"John the electrician, with call and WhatsApp."*
5. **Capture (45 s).** Floating **+** — type a name, pick category and date, save — *"Two seconds to add, and from then on it watches it for you."* Point to it appearing in Calendar.
6. **Calendar + Profile (45 s).** Month dots and upcoming. Then Profile: switch language to **Hausa** and back (*"Four languages, not an afterthought"*), mention export/delete and that there is no tracking.
7. **Close (30 s).** *"Local-first, offline, free, private — web, installable, and a signed Android APK."* Recap the roadmap in one breath: sync next, payments later, free tier stays free. Repeat the positioning line.

**Fallback if live network fails:** use the captured screens on `/prototype` or the APK — every flow above is also visible in the ten screenshots.

---

## 18. Demo instructions

**Run locally**

```powershell
npm install
npm run dev          # http://localhost:3100
```

In the app: **Open with demo data** on the welcome screen (or clear site data for a fresh first-run).

**Full verification (what CI does)**

```powershell
npm run typecheck
npm run lint
npm test                     # 368 tests
npm run smoke                # builds + walks every tab in a real browser
npm run check:csp            # builds + verifies the Content-Security-Policy
npm run qa:responsive        # builds + 5 viewports, 0 findings
```

**Regenerate the presentation screenshots**

```powershell
npm run build
node scripts/capture-prototype.mjs   # writes public/prototype/*.png (390×844 @2x)
```

The script serves the export, opens the demo, and walks ten states: welcome, value props, home, quick add, life, detail, Documents module, alerts, calendar, profile. `/prototype` reads these images at request time, so a re-capture refreshes the presentation without a code change.

**Ship**

```powershell
npm run build
npx wrangler deploy                 # live site (run twice if the first errors)
# Android:
.\build-android.ps1 -SkipWeb        # signs with android/keystore/release.keystore
gh release upload v0.1.0 out\livanta-0.1.0-release.apk --repo temmyadekunle/Livanta --clobber
```

**Presentation route:** https://livanta.folababy02.workers.dev/prototype/ — same content as this document, with the ten captures, screen inventory, flows, roadmap and demo script rendered as a single page.

---

*Prepared by Temitope Adekunle · Livanta v0.1.0 · beta, invite-only · this presentation accompanies the working prototype.*
