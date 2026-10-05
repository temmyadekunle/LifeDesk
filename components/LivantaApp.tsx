"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLivanta } from "@/lib/useLivanta";
import { useAuth } from "@/lib/useAuth";
import { useCloudSync } from "@/lib/useCloudSync";
import { AccountPanel } from "./AccountPanel";
import { daysUntil } from "@/lib/risk";
import { formatNaira, type Locale } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import {
  downloadJson,
  exportPayload,
  leadDaysCrossed,
  announcePermissionChange,
  notificationPermission,
  notifyUrgentAlert,
  reminderCopy,
  requestNotificationPermission,
  serverPermissionSnapshot,
  subscribeToPermission,
} from "@/lib/notifications";
import Onboarding, { LocalePicker } from "@/components/Onboarding";
import ThingEditor, {
  fromEditorValues,
  toEditorValues,
  type EditorPreset,
  type EditorValues,
} from "@/components/ThingEditor";
import ModuleScreen, { MODULES, type ModuleId } from "@/components/ModuleScreen";
import type { Alert, Category, Priority, Thing } from "@/lib/types";

type Tab = "home" | "things" | "alerts" | "household" | "profile";

const TABS: { id: Tab; labelKey: TKey; ico: string }[] = [
  { id: "home", labelKey: "tab.home", ico: "🏠" },
  { id: "things", labelKey: "tab.things", ico: "📋" },
  { id: "alerts", labelKey: "tab.alerts", ico: "🔔" },
  { id: "household", labelKey: "tab.household", ico: "👨‍👩‍👧" },
  { id: "profile", labelKey: "tab.profile", ico: "👤" },
];

const CATEGORIES: { id: Category; labelKey: TKey; ico: string; color: string }[] = [
  { id: "home", labelKey: "cat.home", ico: "🏠", color: "var(--home)" },
  { id: "transport", labelKey: "cat.transport", ico: "🚗", color: "var(--transport)" },
  { id: "money", labelKey: "cat.money", ico: "💳", color: "var(--money)" },
  { id: "documents", labelKey: "cat.documents", ico: "📄", color: "var(--documents)" },
  { id: "family", labelKey: "cat.family", ico: "👨‍👩‍👧", color: "var(--family)" },
  { id: "services", labelKey: "cat.services", ico: "🔧", color: "var(--maintenance)" },
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

const QUICK_ADD: { labelKey: TKey; kind: EditorPreset["kind"]; category: Category }[] = [
  { labelKey: "kind.reminder", kind: "reminder", category: "family" },
  { labelKey: "kind.bill", kind: "bill", category: "money" },
  { labelKey: "kind.document", kind: "document", category: "documents" },
  { labelKey: "kind.asset", kind: "asset", category: "home" },
];

export default function LivantaApp() {
    const [tab, setTab] = useState<Tab>("home");
    const [module, setModule] = useState<ModuleId | null>(null);
    const desk = useLivanta();
    const { t } = desk;
    const { refresh } = desk;

    const auth = useAuth();
    const sync = useCloudSync({ dataSaver: desk.settings.dataSaver });

    // A completed sync that pulled changes writes to IndexedDB, so the desk
    // hook has to re-read for the new state to appear.
    useEffect(() => {
      sync.bindRefresh(() => void refresh());
    }, [sync, refresh]);

  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!desk.ready || !desk.settings.notifyUrgent) return;
    const urgent = desk.alerts.find((a) => a.priority === "urgent");
    if (!urgent) return;
    if (notifyUrgentAlert(urgent, notified.current)) {
      notified.current.add(urgent.id);
    }
  }, [desk.ready, desk.settings.notifyUrgent, desk.alerts]);

  if (desk.ready && !desk.settings.onboarded) {
    return (
      <div className="phone" lang={desk.settings.locale}>
        <main className="screen ob-screen">
          <Onboarding
            locale={desk.settings.locale}
            onDone={(result) => void desk.completeOnboarding(result)}
            onSample={(locale) => {
              void desk.completeOnboarding({
                displayName: desk.settings.displayName || "Temmy",
                categories: ["home", "money", "transport", "documents"],
                firstThing: null,
                loadSample: true,
                locale,
              });
            }}
          />
        </main>
      </div>
    );
  }

  if (!desk.ready) {
    return (
      <div className="phone" lang="en">
        <main className="screen">
          <section className="card">
            <p className="card-meta">{desk.t("app.loading")}</p>
          </section>
        </main>
      </div>
    );
  }

  if (module) {
    const active = MODULES.find((m) => m.id === module);
    return (
      <div className="phone" lang={desk.settings.locale}>
        <header className="app-header">
          <button className="back" onClick={() => setModule(null)}>
            ← {t("app.back")}
          </button>
          <h1>
            {active?.ico} {active ? t(active.labelKey) : ""}
          </h1>
        </header>
        <main className="screen">
          <ModuleScreen
            module={module}
            things={desk.things}
            t={t}
            onOpenThing={() => {
              setModule(null);
              setTab("things");
            }}
          />
        </main>
        <nav className="tabbar">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.id}
              className="tab"
              onClick={() => {
                setModule(null);
                setTab(tabDef.id);
              }}
            >
              <span className="ico">{tabDef.ico}</span>
              {t(tabDef.labelKey)}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="phone" lang={desk.settings.locale}>
      <header className="app-header">
        <div className="header-top">
          <Image
            src="/logo.jpeg"
            alt=""
            width={1080}
            height={720}
            className="header-logo"
          />
          <span className="header-brand">Livanta</span>
        </div>
        <h1>
          {t("app.greeting", {
            name: desk.settings.displayName || "Temmy",
          })}{" "}
          👋
        </h1>
        <p>{desk.loading ? t("app.loading") : desk.status.headline}</p>
        <div className={`status-pill ${LEVEL_STYLE[desk.status.level]}`}>
          <span className="dot" />
          {desk.status.label}
        </div>
      </header>

      <main className="screen">
        {desk.error && (
          <section className="card alert-urgent">
            <p className="section-label">{t("app.error.label")}</p>
            <h3 className="card-title">{t("app.error.title")}</h3>
            <p className="card-meta">{desk.error}</p>
          </section>
        )}

        {tab === "home" && <HomeScreen desk={desk} onOpenModule={setModule} />}
        {tab === "things" && <ThingsScreen desk={desk} />}
        {tab === "alerts" && <AlertsScreen desk={desk} />}
        {tab === "household" && (
          <section className="card accent-teal">
            <p className="section-label">{t("household.title")}</p>
            <h3 className="card-title">{t("household.soon")}</h3>
            <p className="card-meta">{t("household.blurb")}</p>
          </section>
        )}
        {tab === "profile" && <ProfileScreen desk={desk} auth={auth} sync={sync} />}
      </main>

      <nav className="tabbar">
        {TABS.map((tabDef) => (
          <button
            key={tabDef.id}
            className={tabDef.id === tab ? "tab active" : "tab"}
            onClick={() => setTab(tabDef.id)}
            aria-current={tabDef.id === tab ? "page" : undefined}
          >
            <span className="ico">{tabDef.ico}</span>
            {t(tabDef.labelKey)}
            {tabDef.id === "alerts" && desk.status.urgentCount > 0 && (
              <span className="tab-badge">{desk.status.urgentCount}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Desk = ReturnType<typeof useLivanta>;

function HomeScreen({
  desk,
  onOpenModule,
}: {
  desk: Desk;
  onOpenModule: (id: ModuleId) => void;
}) {
  const { t } = desk;
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
        <p className="section-label">{t("home.thisWeek")}</p>
        <div className="stat-row">
          <Stat n={desk.status.urgentCount} label={t("home.stat.urgent")} tone="urgent" />
          <Stat n={desk.status.importantCount} label={t("home.stat.upcoming")} tone="important" />
          <Stat n={desk.status.onTrackCount} label={t("home.stat.onTrack")} tone="routine" />
        </div>
      </section>

      <section className="card alert-urgent">
        <p className="section-label">{t("home.needsAttention")}</p>
        {desk.loading ? (
          <p className="card-meta">{t("home.reading")}</p>
        ) : top.length === 0 ? (
          <p className="card-meta">{t("home.nothingUrgent")}</p>
        ) : (
          top.map((a) => (
            <div key={a.id} style={{ marginBottom: 14 }}>
              <AlertBody alert={a} t={t} />
              <AlertActions alert={a} desk={desk} />
            </div>
          ))
        )}
      </section>

      <section className="card">
        <p className="section-label">{t("home.comingSoon")}</p>
        {desk.totals.items.slice(0, 3).map((item) => (
          <ThingRow key={item.id} thing={item} t={t} />
        ))}
        {desk.totals.items.length === 0 && (
          <p className="card-meta">{t("home.nothing30")}</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">{t("home.commitments")}</p>
        <div className="amount">{formatNaira(desk.totals.total)}</div>
        <p className="card-meta">{t.n("home.next30", desk.totals.count)}</p>
      </section>

      <section className="card">
        <p className="section-label">{t("home.modules")}</p>
        <div className="module-grid">
          {MODULES.map((m) => (
            <button key={m.id} className="module" onClick={() => onOpenModule(m.id)}>
              <span className="module-ico" style={{ color: m.color }}>
                {m.ico}
              </span>
              <span className="module-label">{t(m.labelKey)}</span>
              <span className="module-blurb">{t(m.blurbKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="section-label">{t("home.quickAdd")}</p>
        <div className="quick-grid">
          {QUICK_ADD.map((q) => (
            <button
              key={q.kind}
              className="btn btn-secondary"
              onClick={() => setAdding({ label: t(q.labelKey), kind: q.kind, category: q.category })}
            >
              {KIND_ICO[q.kind]} {t(q.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {adding && (
        <section className="card">
          <ThingEditor
            preset={adding}
            t={t}
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
  const { t } = desk;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Thing | null>(null);
  const [adding, setAdding] = useState<EditorPreset | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return desk.things
      .filter((item) => (showDone ? true : item.status === "active"))
      .filter((item) => (category === "all" ? true : item.category === category))
      .filter((item) =>
        q === ""
          ? true
          : item.name.toLowerCase().includes(q) ||
            (item.notes ?? "").toLowerCase().includes(q),
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

  async function remove(item: Thing) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(t("things.confirmDelete", { name: item.name }))
    ) {
      return;
    }
    await desk.removeThing(item.id);
  }

  const completedCount = desk.things.filter((item) => item.status === "completed").length;

  return (
    <>
      <section className="card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label htmlFor="t-search">{t("things.search")}</label>
          <input
            id="t-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("things.searchPlaceholder")}
          />
        </div>
        <div className="chips">
          <button
            className={category === "all" ? "chip on" : "chip"}
            onClick={() => setCategory("all")}
          >
            {t("things.filterAll")}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={category === c.id ? "chip on" : "chip"}
              onClick={() => setCategory(c.id)}
            >
              {c.ico} {t(c.labelKey)}
            </button>
          ))}
        </div>
        <label className="check" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          {t("things.showCompleted", { n: completedCount })}
        </label>
      </section>

      <section className="card">
        <p className="section-label">{t.n("things.count", filtered.length)}</p>
        {filtered.map((item) => (
          <div className="thing-block" key={item.id}>
            <ThingRow thing={item} t={t} />
            <div className="thing-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(item)}
              >
                {t("things.edit")}
              </button>
              {item.status === "active" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void desk.completeThing(item)}
                >
                  {t("things.markHandled")}
                </button>
              )}
              <button
                className="btn btn-danger btn-sm"
                onClick={() => void remove(item)}
              >
                {t("things.delete")}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="card-meta">{t("things.nothingMatches")}</p>
        )}
      </section>

      {adding && (
        <section className="card">
          <ThingEditor
            preset={adding}
            t={t}
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
              label: t(`kind.${editing.kind}` as TKey),
              kind: editing.kind,
              category: editing.category,
            }}
            t={t}
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
  const { t } = desk;

  return (
    <>
      <p className="section-label">
        {t.n("alerts.count", desk.alerts.length, { status: desk.status.label })}
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
          <AlertBody alert={a} t={t} />
          <AlertActions alert={a} desk={desk} />
        </section>
      ))}
      {desk.alerts.length === 0 && (
        <section className="card">
          <p className="card-meta">{t("alerts.none")}</p>
          <div style={{ marginTop: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => void desk.restoreAlerts()}
            >
              {t("alerts.restore")}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function ProfileScreen({
  desk,
  auth,
  sync,
}: {
  desk: Desk;
  auth: ReturnType<typeof useAuth>;
  sync: ReturnType<typeof useCloudSync>;
}) {
  const { t } = desk;
  const permission = useSyncExternalStore(
    subscribeToPermission,
    notificationPermission,
    serverPermissionSnapshot,
  );
  const [notice, setNotice] = useState<string | null>(null);

  const upcoming = useMemo(
    () =>
      desk.things
        .filter((item) => item.status === "active" && item.dueDate)
        .map((item) => ({ thing: item, leads: leadDaysCrossed(item, desk.settings.leadDays) }))
        .filter((x) => x.leads.length > 0)
        .slice(0, 4),
    [desk.things, desk.settings.leadDays],
  );

  return (
    <>
      <section className="card">
        <p className="section-label">{t("profile.account")}</p>
        <div className="row">
          <span className="lead">👤</span>
          <span className="grow">
            <div className="name">{desk.settings.displayName || "Temmy"}</div>
            <div className="sub">{t("profile.freePlan")}</div>
          </span>
        </div>
      </section>

      <AccountPanel t={t} auth={auth} sync={sync} />

      <section className="card">
        <p className="section-label">{t("profile.language")}</p>
        <LocalePicker
          locale={desk.settings.locale}
          t={t}
          onChange={(locale: Locale) => void desk.updateSettings({ locale })}
        />
        <p className="card-meta" style={{ marginTop: 8 }}>
          {t("profile.languageHint")}
        </p>
      </section>

      <section className="card">
        <p className="section-label">{t("profile.notifications")}</p>
        {permission === "unsupported" && (
          <p className="card-meta">{t("profile.notifUnsupported")}</p>
        )}
        {permission === "default" && (
          <button
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={async () => {
            await requestNotificationPermission();
            announcePermissionChange();
          }}
          >
            {t("profile.enableAlerts")}
          </button>
        )}
        {permission === "granted" && (
          <p className="card-meta">{t("profile.notifGranted")}</p>
        )}
        {permission === "denied" && (
          <p className="card-meta">{t("profile.notifDenied")}</p>
        )}
        <label className="check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={desk.settings.notifyUrgent}
            onChange={(e) => void desk.updateSettings({ notifyUrgent: e.target.checked })}
          />
          {t("profile.notifyUrgent")}
        </label>
      </section>

      <section className="card">
        <p className="section-label">{t("profile.reminderSchedule")}</p>
        <div className="chips">
          {[90, 60, 30, 14, 7, 1].map((n) => (
            <button
              key={n}
              className={
                desk.settings.leadDays.includes(n) ? "chip on" : "chip"
              }
              onClick={() =>
                void desk.updateSettings({
                  leadDays: desk.settings.leadDays.includes(n)
                    ? desk.settings.leadDays.filter((d) => d !== n)
                    : [...desk.settings.leadDays, n].sort((a, b) => b - a),
                })
              }
            >
              {n}d
            </button>
          ))}
        </div>
        {upcoming.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="section-label">{t("profile.preview")}</p>
            {upcoming.map(({ thing, leads }) => {
              const copy = reminderCopy(thing, leads[0], t);
              return (
                <div className="row" key={thing.id}>
                  <span className="grow">
                    <div className="name">{copy.title}</div>
                    <div className="sub">{copy.body}</div>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <p className="section-label">{t("profile.data")}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={desk.settings.dataSaver}
            onChange={(e) => void desk.updateSettings({ dataSaver: e.target.checked })}
          />
          {t("profile.dataSaver")}
        </label>
        <p className="card-meta" style={{ marginTop: 6 }}>
          {t("profile.dataSaverHint")}
        </p>
        <div className="quick-grid" style={{ marginTop: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              downloadJson(
                "livanta-export.json",
                exportPayload(desk.things, desk.settings),
              );
              setNotice(t("profile.exportDone"));
            }}
          >
            {t("profile.export")}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void desk.loadSampleData()}
          >
            {t("profile.loadSample")}
          </button>
        </div>
        {notice && <p className="card-meta" style={{ marginTop: 8 }}>{notice}</p>}
      </section>

      <section className="card">
        <p className="section-label">{t("profile.yourData")}</p>
        <p className="card-meta">{t.n("profile.yourDataBody", desk.things.length)}</p>
        <button
          className="btn btn-danger"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm(t("profile.confirmDeleteAll"))
            ) {
              void desk.deleteEverything();
              window.location.reload();
            }
          }}
        >
          {t("profile.deleteAll")}
        </button>
      </section>
    </>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: Priority;
}) {
  return (
    <div className="stat">
      <div className={`stat-num ${tone}`}>{n}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function AlertBody({
  alert,
  t,
}: {
  alert: Alert;
  t: ReturnType<typeof useLivanta>["t"];
}) {
  return (
    <>
      <h3 className="card-title">{alert.title}</h3>
      <p className="card-meta">{alert.message}</p>
      <div style={{ marginTop: 8 }}>
        <span className={`badge ${PRIORITY_CLASS[alert.priority]}`}>
          {t(`priority.${alert.priority}` as TKey)}
        </span>
      </div>
    </>
  );
}

function AlertActions({ alert, desk }: { alert: Alert; desk: Desk }) {
  const { t } = desk;
  const thing = desk.things.find((item) => item.id === alert.thingId);

  return (
    <div className="quick-grid" style={{ marginTop: 12 }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => void desk.dismissAlert(alert)}
      >
        {t("action.remindLater")}
      </button>
      <button
        className="btn btn-primary btn-sm"
        disabled={!thing}
        onClick={() => thing && void desk.completeThing(thing)}
      >
        {t("action.markHandled")}
      </button>
    </div>
  );
}

function ThingRow({
  thing,
  t,
}: {
  thing: Thing;
  t: ReturnType<typeof useLivanta>["t"];
}) {
  const days = thing.dueDate ? daysUntil(thing.dueDate) : null;
  const sub =
    thing.status === "completed"
      ? t("row.completed")
      : days === null
        ? thing.notes ?? t("row.noDate")
        : days < 0
          ? t.n("row.overdue", Math.abs(days))
          : t.n("row.dueIn", days);

  return (
    <div className="row">
      <span className="lead">{KIND_ICO[thing.kind] ?? "•"}</span>
      <span className="grow">
        <div className="name">{thing.name}</div>
        <div className="sub">{sub}</div>
      </span>
      {thing.amount ? (
        <span className="sub">{formatNaira(thing.amount)}</span>
      ) : (
        <span className={`badge ${PRIORITY_CLASS[thing.priority]}`}>
          {t(`priority.${thing.priority}` as TKey)}
        </span>
      )}
    </div>
  );
}