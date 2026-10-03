"use client";

import { useMemo, useState } from "react";
import { useLifeDesk } from "@/lib/useLifeDesk";
import { daysUntil } from "@/lib/risk";
import ThingEditor, {
  fromEditorValues,
  toEditorValues,
  type EditorPreset,
  type EditorValues,
} from "@/components/ThingEditor";
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

const LEVEL_STYLE = {
  stable: "level-stable",
  "needs-attention": "level-attention",
  immediate: "level-immediate",
} as const;

const QUICK_ADD: EditorPreset[] = [
  { label: "Reminder", kind: "reminder", category: "family" },
  { label: "Bill", kind: "bill", category: "money" },
  { label: "Document", kind: "document", category: "documents" },
  { label: "Asset", kind: "asset", category: "home" },
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
  const [adding, setAdding] = useState<EditorPreset | null>(null);
  const [busy, setBusy] = useState(false);

  const top = desk.alerts.slice(0, 3);

  async function save(values: EditorValues) {
    if (!adding) return;
    setBusy(true);
    await desk.addThing(fromEditorValues(values));
    setBusy(false);
    setAdding(null);
  }

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
              <AlertActions alert={a} desk={desk} />
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
              onClick={() => setAdding(q)}
            >
              {KIND_ICO[q.kind]} {q.label}
            </button>
          ))}
        </div>
      </section>

      {adding && (
        <section className="card">
          <ThingEditor
            preset={adding}
            onSave={save}
            onCancel={() => setAdding(null)}
            busy={busy}
          />
        </section>
      )}
    </>
  );
}

function ThingsScreen({ desk }: { desk: Desk }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Thing | null>(null);
  const [adding, setAdding] = useState<EditorPreset | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return desk.things
      .filter((t) => (showDone ? true : t.status === "active"))
      .filter((t) => (category === "all" ? true : t.category === category))
      .filter((t) =>
        q === ""
          ? true
          : t.name.toLowerCase().includes(q) ||
            (t.notes ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [desk.things, query, category, showDone]);

  async function saveEdit(values: EditorValues) {
    if (!editing) return;
    setBusy(true);
    await desk.updateThing(editing, fromEditorValues(values));
    setBusy(false);
    setEditing(null);
  }

  async function saveAdd(values: EditorValues) {
    if (!adding) return;
    setBusy(true);
    await desk.addThing(fromEditorValues(values));
    setBusy(false);
    setAdding(null);
  }

  async function remove(t: Thing) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${t.name}"? This cannot be undone.`)
    ) {
      return;
    }
    await desk.removeThing(t.id);
  }

  const completedCount = desk.things.filter((t) => t.status === "completed").length;

  return (
    <>
      <section className="card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="t-search">Search</label>
          <input
            id="t-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search things and notes"
          />
        </div>
        <div className="chips">
          <button
            className={category === "all" ? "chip on" : "chip"}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "chip on" : "chip"}
              onClick={() => setCategory(c.id)}
            >
              {c.ico} {c.label}
            </button>
          ))}
        </div>
        <label className="check" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          Show completed ({completedCount})
        </label>
      </section>

      <section className="card">
        <p className="section-label">
          {filtered.length} thing{filtered.length === 1 ? "" : "s"}
        </p>
        {filtered.map((t) => (
          <div className="thing-block" key={t.id}>
            <ThingRow thing={t} />
            <div className="thing-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(t)}
              >
                Edit
              </button>
              {t.status === "active" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void desk.completeThing(t)}
                >
                  Mark handled
                </button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => void remove(t)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="card-meta">Nothing matches those filters.</p>
        )}
      </section>

      {adding && (
        <section className="card">
          <ThingEditor
            preset={adding}
            onSave={saveAdd}
            onCancel={() => setAdding(null)}
            busy={busy}
          />
        </section>
      )}

      {editing && (
        <section className="card">
          <ThingEditor
            preset={{
              label: KIND_ICO[editing.kind] ?? "Thing",
              kind: editing.kind,
              category: editing.category,
            }}
            initial={toEditorValues(editing)}
            onSave={saveEdit}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        </section>
      )}
    </>
  );
}

function AlertsScreen({ desk }: { desk: Desk }) {
  return (
    <>
      <p className="section-label">
        {desk.alerts.length} alert{desk.alerts.length === 1 ? "" : "s"} ·{" "}
        {desk.status.label}
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
          <AlertActions alert={a} desk={desk} />
        </section>
      ))}
      {desk.alerts.length === 0 && (
        <section className="card">
          <p className="card-meta">No alerts. Nothing needs attention.</p>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => void desk.restoreAlerts()}
            >
              Restore dismissed alerts
            </button>
          </div>
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

function AlertActions({ alert, desk }: { alert: Alert; desk: Desk }) {
  const thing = desk.things.find((t) => t.id === alert.thingId);

  return (
    <div className="quick-grid" style={{ marginTop: 12 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => void desk.dismissAlert(alert)}
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
    thing.status === "completed"
      ? "Completed"
      : days === null
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