"use client";

import { useState } from "react";
import { useLifeDesk } from "@/lib/useLifeDesk";
import { daysUntil } from "@/lib/risk";
import type { LifeLevel } from "@/lib/status";
import type { Alert, Category, Priority, Thing, ThingKind } from "@/lib/types";

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

const LEVEL_STYLE: Record<LifeLevel, string> = {
  stable: "level-stable",
  "needs-attention": "level-attention",
  immediate: "level-immediate",
};

const QUICK_ADD: { label: string; ico: string; kind: ThingKind; category: Category }[] = [
  { label: "Reminder", ico: "🔔", kind: "reminder", category: "family" },
  { label: "Bill", ico: "🧾", kind: "bill", category: "money" },
  { label: "Document", ico: "📄", kind: "document", category: "documents" },
  { label: "Asset", ico: "📦", kind: "asset", category: "home" },
];

export default function LifeDeskApp() {
  const [tab, setTab] = useState<Tab>("home");
  const desk = useLifeDesk();

  return (
    <div className="phone">
      <header className="app-header">
        <h1>Good morning, Temmy 👋</h1>
        <p>{desk.loading ? "Opening your LifeDesk…" : desk.status.headline}</p>
        <div className={`status-pill ${LEVEL_STYLE[desk.status.level]}`}>
          <span className="dot" />
          {desk.status.label}
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
            {t.id === "alerts" && desk.status.urgentCount > 0 && (
              <span className="tab-badge">{desk.status.urgentCount}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Desk = ReturnType<typeof useLifeDesk>;

function HomeScreen({ desk }: { desk: Desk }) {
  const [adding, setAdding] = useState<ThingKind | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = desk.alerts.filter((a) => !dismissed.includes(a.id));
  const top = visible.slice(0, 3);

  return (
    <>
      <section className="card">
        <p className="section-label">This week</p>
        <div className="stat-row">
          <Stat n={desk.status.urgentCount} label="urgent" tone="urgent" />
          <Stat n={desk.status.importantCount} label="upcoming" tone="important" />
          <Stat n={desk.status.onTrackCount} label="on track" tone="routine" />
        </div>
      </section>

      <section className="card alert-urgent">
        <p className="section-label">Needs attention</p>
        {desk.loading ? (
          <p className="card-meta">Reading your local records…</p>
        ) : top.length === 0 ? (
          <p className="card-meta">Nothing urgent. You&apos;re on track.</p>
        ) : (
          top.map((a) => (
            <div key={a.id} style={{ marginBottom: 14 }}>
              <AlertBody alert={a} />
              <AlertActions
                alert={a}
                desk={desk}
                onDismiss={() => {
                  void desk.dismissAlert(a);
                  setDismissed((d) => [...d, a.id]);
                }}
              />
            </div>
          ))
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
          {QUICK_ADD.map((q) => (
            <button
              key={q.kind}
              className="btn btn-secondary"
              onClick={() => setAdding(q.kind)}
            >
              {q.ico} {q.label}
            </button>
          ))}
        </div>
      </section>

      {adding && <AddForm desk={desk} kind={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

function AddForm({
  desk,
  kind,
  onClose,
}: {
  desk: Desk;
  kind: ThingKind;
  onClose: () => void;
}) {
  const preset = QUICK_ADD.find((q) => q.kind === kind)!;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    await desk.addThing({
      name: trimmed,
      category: preset.category,
      kind,
      amount: amount ? Number(amount) : null,
      dueDate: dueDate || null,
      recurrence: recurring ? { frequency: "monthly", interval: 1 } : null,
    });
    setBusy(false);
    onClose();
  }

  return (
    <section className="card accent-teal">
      <p className="section-label">
        New {preset.label.toLowerCase()}
      </p>
      <div className="field">
        <label htmlFor="f-name">What is it?</label>
        <input
          id="f-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            kind === "document"
              ? "e.g. Driver's licence"
              : kind === "asset"
                ? "e.g. Refrigerator"
                : kind === "bill"
                  ? "e.g. Water bill"
                  : "e.g. Dentist appointment"
          }
        />
      </div>
      <div className="field">
        <label htmlFor="f-amount">Amount (optional)</label>
        <input
          id="f-amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 45000"
        />
      </div>
      <div className="field">
        <label htmlFor="f-due">Due or expiry date</label>
        <input
          id="f-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <div className="hint">Leave empty if there is no date yet.</div>
      </div>
      {kind !== "document" && kind !== "asset" && (
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Repeats every month
          </label>
        </div>
      )}
      <div className="quick-grid">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!name.trim() || busy}
        >
          Save
        </button>
      </div>
    </section>
  );
}

function ThingsScreen({ desk }: { desk: Desk }) {
  const [openId, setOpenId] = useState<string | null>(null);

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
              <div key={t.id}>
                <button
                  className="row-btn"
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                >
                  <ThingRow thing={t} />
                </button>
                {openId === t.id && (
                  <div className="inline-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => void desk.completeThing(t)}
                    >
                      Mark handled
                    </button>
                    <span className="sub">
                      {t.recurrence
                        ? "Recurring — will roll to the next due date."
                        : "Will be marked completed."}
                    </span>
                  </div>
                )}
              </div>
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
        {desk.alerts.length} alert{desk.alerts.length === 1 ? "" : "s"} ·{" "}
        {desk.status.level}
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
          <AlertBody alert={a} />
          <AlertActions
            alert={a}
            desk={desk}
            onDismiss={() => void desk.dismissAlert(a)}
          />
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

function Stat({ n, label, tone }: { n: number; label: string; tone: Priority }) {
  return (
    <div className="stat">
      <div className={`stat-num ${tone}`}>{n}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function AlertBody({ alert }: { alert: Alert }) {
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

function AlertActions({
  alert,
  desk,
  onDismiss,
}: {
  alert: Alert;
  desk: Desk;
  onDismiss: () => void;
}) {
  const thing = desk.things.find((t) => t.id === alert.thingId);

  return (
    <div className="quick-grid" style={{ marginTop: 12 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={onDismiss}
      >
        Remind me later
      </button>
      <button
        className="btn btn-primary btn-sm"
        disabled={!thing}
        onClick={() => thing && void desk.completeThing(thing)}
      >
        Mark as handled
      </button>
    </div>
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