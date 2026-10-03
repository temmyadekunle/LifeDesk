# LifeDesk — Implementation Plan

Goal: take the LifeDesk PRD (mobile-first Nigerian life-management app) to a working MVP, running locally.

## Proposed stack (runs locally for now)

- **App framework:** Expo (React Native) — single codebase for Android/iOS, good offline-first support.
- **Database:** SQLite (expo-sqlite) — local, offline-first, no server needed yet.
- **Authentication:** None for MVP — local-only app; optional PIN/biometric lock later. (No accounts required at first.)
- **File storage:** Device local storage (expo-file-system) — receipts/documents saved on-device, uploaded later.
- **State/UI:** React, React Navigation, simple local state.
- **Build target:** Expo Go / local Android emulator. App and database run locally.

**Decision:** We keep Expo (React Native) as the framework. It suits LifeDesk because it gives one codebase for Android and iOS, strong offline-first support (SQLite, local notifications, file storage), and a fast path to a demoable MVP before any backend exists.

## Phase 0 — Setup
- Create Expo project, navigation skeleton, theme (Deep Navy `#172B4D`, Life Teal `#16A6A0`, Amber `#F4B942`, Off White `#F7F9FC`).
- **Produces:** running app shell with Home / Things / Alerts / Household / Profile tabs.

## Phase 1 — Data model + local DB
- SQLite schema: Thing, Reminder, Bill, Document, Vehicle, Asset, Alert.
- Seed categories (Home, Transport, Money, Documents, Family, Services).
- **Produces:** local database with create/read/update/delete for Things and reminders.

## Phase 2 — Dashboard + Alerts
- Home screen: greeting, "Needs attention", "Coming soon", upcoming commitments, Quick Add.
- Simple risk engine v1: overdue, expiring soon, due within N days.
- **Produces:** working dashboard showing real alerts from local data.

## Phase 3 — Things (core CRUD)
- Add/edit a Thing: name, category, amount, due date, frequency, owner.
- Category views.
- **Produces:** users can add bills, documents, vehicles, assets and see them listed.

## Phase 4 — Modules
- Home, Vehicles, Bills, Documents, Assets sub-screens.
- Warranty/expiry tracking.
- **Produces:** the five MVP modules functional offline.

## Phase 5 — Notifications + polish
- Local notifications for upcoming/overdue items.
- Polish UI, empty states, onboarding.
- **Produces:** a complete, demoable local MVP.

## Later phases (not in local MVP)
- Household sharing, AI assistant, receipt scanning, service marketplace, cloud sync + real accounts (Supabase), backup/export.
