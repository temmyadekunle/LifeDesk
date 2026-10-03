"use client";

import { useState } from "react";

type Tab = "home" | "things" | "alerts" | "household" | "profile";

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: "home", label: "Home", ico: "🏠" },
  { id: "things", label: "Things", ico: "📋" },
  { id: "alerts", label: "Alerts", ico: "🔔" },
  { id: "household", label: "Household", ico: "👨‍👩‍👧" },
  { id: "profile", label: "Profile", ico: "👤" },
];

const CATEGORIES = [
  { label: "Home", ico: "🏠", color: "var(--home)" },
  { label: "Transport", ico: "🚗", color: "var(--transport)" },
  { label: "Money", ico: "💳", color: "var(--money)" },
  { label: "Documents", ico: "📄", color: "var(--documents)" },
  { label: "Family", ico: "👨‍👩‍👧", color: "var(--family)" },
  { label: "Services", ico: "🔧", color: "var(--maintenance)" },
];

export default function LifeDeskApp() {
  const [tab, setTab] = useState<Tab>("home");

  return (
    <div className="phone">
      <header className="app-header">
        <h1>Good morning, Temmy 👋</h1>
        <p>Here&apos;s what needs your attention.</p>
        <div className="status-pill">
          <span className="dot" />
          You&apos;re mostly on track
        </div>
      </header>

      <main className="screen">
        {tab === "home" && <HomeScreen />}
        {tab === "things" && <ThingsScreen />}
        {tab === "alerts" && <AlertsScreen />}
        {tab === "household" && <PlaceholderScreen title="Household" phase="Phase 5" note="Shared responsibilities and member permissions land here." />}
        {tab === "profile" && <ProfileScreen />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
            aria-current={t.id === tab ? "page" : undefined}
          >
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function HomeScreen() {
  return (
    <>
      <section className="card alert-urgent">
        <p className="section-label">Needs attention</p>
        <h3 className="card-title">Generator service overdue</h3>
        <p className="card-meta">Last serviced 4 months ago. Delaying routine maintenance may increase repair costs.</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary">Take action</button>
        </div>
      </section>

      <section className="card">
        <p className="section-label">Coming soon</p>
        <div className="row">
          <span className="lead">🚗</span>
          <span className="grow">
            <div className="name">Vehicle insurance</div>
            <div className="sub">Expires in 12 days</div>
          </span>
          <span className="badge b-important">Important</span>
        </div>
        <div className="row">
          <span className="lead">💳</span>
          <span className="grow">
            <div className="name">Internet subscription</div>
            <div className="sub">Renews in 3 days</div>
          </span>
          <span className="badge b-upcoming">Upcoming</span>
        </div>
        <div className="row">
          <span className="lead">🏠</span>
          <span className="grow">
            <div className="name">Rent</div>
            <div className="sub">Due in 30 days</div>
          </span>
          <span className="badge b-routine">Routine</span>
        </div>
      </section>

      <section className="card">
        <p className="section-label">Upcoming commitments</p>
        <div className="amount">₦1,470,000</div>
        <p className="card-meta">Next 30 days</p>
      </section>

      <section className="card">
        <p className="section-label">Quick add</p>
        <div className="quick-grid">
          <button className="btn btn-secondary">＋ Reminder</button>
          <button className="btn btn-secondary">＋ Bill</button>
          <button className="btn btn-secondary">＋ Document</button>
          <button className="btn btn-secondary">＋ Asset</button>
        </div>
      </section>

      <section className="card">
        <p className="section-label">Sample input</p>
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input id="amount" type="text" placeholder="e.g. 1,200,000" />
          <div className="hint">Enter the amount in naira.</div>
        </div>
        <button className="btn btn-primary">Save</button>
      </section>
    </>
  );
}

function ThingsScreen() {
  return (
    <>
      <p className="section-label">Categories</p>
      <section className="card">
        {CATEGORIES.map((c) => (
          <div className="row" key={c.label}>
            <span className="lead" style={{ color: c.color }}>{c.ico}</span>
            <span className="grow">
              <div className="name">{c.label}</div>
            </span>
            <span className="badge b-routine">0</span>
          </div>
        ))}
      </section>
      <p className="phase-note">Thing records arrive in Phase 1.</p>
    </>
  );
}

function AlertsScreen() {
  return (
    <>
      <section className="card alert-urgent">
        <p className="section-label">Urgent</p>
        <h3 className="card-title">Generator service overdue</h3>
        <p className="card-meta">Overdue by 4 months</p>
      </section>
      <section className="card alert-soon">
        <p className="section-label">Important</p>
        <h3 className="card-title">Vehicle insurance expires in 12 days</h3>
        <p className="card-meta">Last premium ₦85,000</p>
      </section>
      <p className="phase-note">Real alerts arrive with the risk engine in Phase 2.</p>
    </>
  );
}

function ProfileScreen() {
  return (
    <>
      <section className="card">
        <p className="section-label">Account</p>
        <div className="row">
          <span className="lead">👤</span>
          <span className="grow">
            <div className="name">Temmy Adekunle</div>
            <div className="sub">Free plan</div>
          </span>
        </div>
      </section>
      <section className="card">
        <p className="section-label">Privacy</p>
        <p className="card-meta">You own your data. We don&apos;t sell personal data. You can export or delete everything at any time.</p>
      </section>
      <p className="phase-note">Authentication and secure storage arrive with cloud sync.</p>
    </>
  );
}

function PlaceholderScreen({ title, phase, note }: { title: string; phase: string; note: string }) {
  return (
    <>
      <section className="card accent-teal">
        <p className="section-label">{title}</p>
        <h3 className="card-title">Coming in {phase}</h3>
        <p className="card-meta">{note}</p>
      </section>
    </>
  );
}