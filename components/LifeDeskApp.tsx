"use client";

import { useState } from "react";
import { useLifeDesk } from "@/lib/useLifeDesk";
import { daysUntil } from "@/lib/risk";
import type { Alert, Category, Priority, Thing } from "@/lib/types";

type Tab = "home" | "things" | "alerts" | "household" | "profile";

const TABS: { id: Tab; label: string; ico: string }[] = [
  { id: "home", label: "Home", ico: "🏠" },
  { id: "things", label: "Things", ico: "📋" },
  { id: "alerts", label: "Alerts", ico: "🔔" },
  { id: "household", label: "Household", ico: "👨‍👩‍👧" },
  { id: "profile", label: "Profile", ico: "👤" },
];

const CATEGORIES: { id: Category; label: string; ico: string; color: string }[] = [
  { id: "home", label: "Home", ico: "🏠", color: "var(--home)" },
  { id: "transport", label: "Transport", ico: "🚗", color: "var(--transport)" },
  { id: "money", label: "Money", ico: "💳", color: "var(--money)" },
  { id: "documents", label: "Documents", ico: "📄", color: "var(--documents)" },
  { id: "family", label: "Family", ico: "👨‍👩‍👧", color: "var(--family)" },
  { id: "services", label: "Services", ico: "🔧", color: "var(--maintenance)" },
];

const PRIORITY_CLASS: Record<Priority, string> = {
  urgent: "b-urgent",
  important: "b-important",
  upcoming: "b-upcoming",
  routine: "b-routine",
};

const KIND_ICO: Record<string, string> = {
  rent: "🏠",
  utility: "💡",
  bill: "🧾",
  subscription: "💳",
  "school-fee": "🎓",
  vehicle: "🚗",
  fuel: "⛽",
  maintenance: "🔧",
  insurance: "🛡️",
  document: "📄",
  asset: "📦",
  appointment: "📅",
  reminder: "🔔",
  "service-provider": "🔧",
};

export default function LifeDeskApp() {
  const [tab, setTab] = useState<Tab>("home");
  const desk = useLifeDesk();

  const urgentCount = desk.alerts.filter((a) => a.priority === "urgent").length;

  return (
    <div className="phone">
      <header className="app-header">
        <h1>Good morning, Temmy 👋</h1>
        <p>Here&apos;s what needs your attention.</p>
        <div className="status-pill">
          <span className="dot" />
          {desk.loading
            ? "Loading your LifeDesk…"
            : urgentCount > 0
              ? `${urgentCount} thing${urgentCount === 1 ? "" : "s"} need attention`
              : "You're mostly on track"}
        </div>
      </header>

      <main className="screen">
        {desk.error && (
          <section className="card alert-urgent">
            <p className="section-label">Local database</p>
            <h3 className="card-title">Could not open storage</h3>
            <p className="card-meta">{desk.error}</p>
          </section>
        )}

        {tab === "home" && <HomeScreen desk={desk} />}
        {tab === "things" && <ThingsScreen desk={desk} />}
        {tab === "alerts" && <AlertsScreen desk={desk} />}
        {tab === "household" && (
          <section className="card accent-teal">
            <p className="section-label">Household</p>
            <h3 className="card-title">Coming in Phase 5</h3>
            <p className="card-meta">
              Shared responsibilities and member permissions land here.
            </p>
          </section>
        )}
        {tab === "profile" && <ProfileScreen desk={desk} />}
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
            {t.id === "alerts" && urgentCount > 0 && (
              <span className="tab-badge">{urgentCount}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Desk = ReturnType<typeof useLifeDesk>;

function HomeScreen({ desk }: { desk: Desk }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saved, setSaved] = useState(false);

  const top = desk.alerts.slice(0, 3);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await desk.addThing({
      name: trimmed,
      category: "money",
      kind: "reminder",
      amount: amount ? Number(amount) : null,
    });
    setName("");
    setAmount("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <section className="card alert-urgent">
        <p className="section-label">Needs attention</p>
        {desk.loading ? (
          <p className="card-meta">Reading your local records…</p>
        ) : top.length === 0 ? (
          <p className="card-meta">Nothing urgent. You're on track.</p>
        ) : (
          top.map((a) => <AlertRow key={a.id} alert={a} />)
        )}
      </section>

      <section className="card">
        <p className="section-label">Coming soon</p>
        {desk.totals.items.slice(0, 3).map((t) => (
          <ThingRow key={t.id} thing={t} />
        ))}
        {desk.totals.items.length === 0 && (
          <p className="card-meta">Nothing due in the next 30 days.</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">Upcoming commitments</p>
        <div className="amount">{desk.formatNaira(desk.totals.total)}</div>
        <p className="card-meta">
          Next 30 days · {desk.totals.count} item
          {desk.totals.count === 1 ? "" : "s"}
        </p>
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
        <p className="section-label">Add a responsibility</p>
        <div className="field">
          <label htmlFor="new-name">What is it?</label>
          <input
            id="new-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Water bill"
          />
        </div>
        <div className="field">
          <label htmlFor="new-amount">Amount (optional)</label>
          <input
            id="new-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 45000"
          />
          <div className="hint">Stored locally on this device.</div>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
          {saved ? "Saved to LifeDesk ✓" : "Save"}
        </button>
      </section>
    </>
  );
}

function ThingsScreen({ desk }: { desk: Desk }) {
  return (
    <>
      <p className="section-label">Categories</p>
      {CATEGORIES.map((c) => {
        const items = desk.byCategory(c.id);
        return (
          <section className="card" key={c.id}>
            <div className="row">
              <span className="lead" style={{ color: c.color }}>
                {c.ico}
              </span>
              <span className="grow">
                <div className="name">{c.label}</div>
                <div className="sub">
                  {items.length} thing{items.length === 1 ? "" : "s"}
                </div>
              </span>
              <span className="badge b-routine">{items.length}</span>
            </div>
            {items.map((t) => (
              <ThingRow key={t.id} thing={t} />
            ))}
          </section>
        );
      })}
    </>
  );
}

function AlertsScreen({ desk }: { desk: Desk }) {
  return (
    <>
      <p className="section-label">
        {desk.alerts.length} alert{desk.alerts.length === 1 ? "" : "s"}
      </p>
      {desk.alerts.map((a) => (
        <section
          className={`card ${
            a.priority === "urgent"
              ? "alert-urgent"
              : a.priority === "important"
                ? "alert-soon"
                : "accent-teal"
          }`}
          key={a.id}
        >
          <AlertRow alert={a} />
        </section>
      ))}
      {desk.alerts.length === 0 && (
        <section className="card">
          <p className="card-meta">No alerts. Nothing needs attention.</p>
        </section>
      )}
    </>
  );
}

function ProfileScreen({ desk }: { desk: Desk }) {
  return (
    <>
      <section className="card">
        <p className="section-label">Account</p>
        <div className="row">
          <span className="lead">👤</span>
          <span className="grow">
            <div className="name">Temmy Adekunle</div>
            <div className="sub">Free plan · local only</div>
          </span>
        </div>
      </section>
      <section className="card">
        <p className="section-label">Your data</p>
        <p className="card-meta">
          {desk.things.length} thing{desk.things.length === 1 ? "" : "s"} stored in
          IndexedDB on this device. Nothing is uploaded. You can delete everything at
          any time.
        </p>
      </section>
    </>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <>
      <h3 className="card-title">{alert.title}</h3>
      <p className="card-meta">{alert.message}</p>
      <div style={{ marginTop: 8 }}>
        <span className={`badge ${PRIORITY_CLASS[alert.priority]}`}>
          {alert.priority}
        </span>
      </div>
    </>
  );
}

function ThingRow({ thing }: { thing: Thing }) {
  const days = thing.dueDate ? daysUntil(thing.dueDate) : null;
  const sub =
    days === null
      ? thing.notes ?? "No date set"
      : days < 0
        ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
        : `Due in ${days} day${days === 1 ? "" : "s"}`;

  return (
    <div className="row">
      <span className="lead">{KIND_ICO[thing.kind] ?? "•"}</span>
      <span className="grow">
        <div className="name">{thing.name}</div>
        <div className="sub">{sub}</div>
      </span>
      {thing.amount ? (
        <span className="sub">{`₦${thing.amount.toLocaleString("en-NG")}`}</span>
      ) : (
        <span className={`badge ${PRIORITY_CLASS[thing.priority]}`}>
          {thing.priority}
        </span>
      )}
    </div>
  );
}