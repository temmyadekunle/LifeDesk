"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon, type IconName } from "./Icons";
import { Avatar } from "./Avatar";
import { ConfirmDialog, Sheet, Toast, useToast } from "./ui";
import { Logo } from "./Logo";
import { QuickAddSheet } from "./QuickAdd";
import { ThingDetailSheet } from "./ThingDetail";
import { AuthScreen } from "./AuthScreen";
import Onboarding from "./Onboarding";
import ModuleScreen, { MODULES, type ModuleId } from "./ModuleScreen";
import ThingEditor, { fromEditorValues } from "./ThingEditor";
import { HomeScreen } from "./screens/HomeScreen";
import { ThingsScreen } from "./screens/ThingsScreen";
import { CalendarScreen } from "./screens/CalendarScreen";
import { ServicesScreen } from "./screens/ServicesScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { CATEGORY_META, KIND_ICON, MODULE_ICON } from "./maps";
import { TINT_BORDER, TINT_SOFT, tint } from "@/lib/color";
import { dueMeta, TONE_CLASS } from "./labels";
import { formatDate } from "@/lib/dates";
import { formatNaira } from "@/lib/i18n";
import { hasAmount } from "@/lib/money";
import { notifyUrgentAlert } from "@/lib/notifications";
import type { EditorPreset } from "@/lib/editor";
import type { TKey } from "@/lib/locales/en";
import type { Thing } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";
import { useCloudSync } from "@/lib/useCloudSync";
import { greetingKey, useDayPart } from "@/lib/useDayPart";
import { useLivanta } from "@/lib/useLivanta";
import InstallPrompt from "./InstallPrompt";

type Tab = "home" | "things" | "calendar" | "services" | "profile";

type Route =
  | { kind: "module"; id: ModuleId }
  | { kind: "notifications" }
  | { kind: "auth" };

const TABS: { id: Tab; labelKey: TKey; icon: IconName }[] = [
  { id: "home", labelKey: "tab.home", icon: "home" },
  { id: "things", labelKey: "tab.things", icon: "list" },
  { id: "calendar", labelKey: "tab.calendar", icon: "calendar" },
  { id: "services", labelKey: "tab.services", icon: "layers" },
  { id: "profile", labelKey: "tab.profile", icon: "user" },
];

export default function LivantaApp() {
  const desk = useLivanta();
  const { t, refresh } = desk;
  const auth = useAuth();
  const sync = useCloudSync({ dataSaver: desk.settings.dataSaver });
  const { toast, showToast } = useToast();

  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Route[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPreset, setQuickPreset] = useState<EditorPreset | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmThing, setConfirmThing] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const push = useCallback((route: Route) => setStack((s) => [...s, route]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);

  useEffect(() => {
    sync.bindRefresh(() => void refresh());
  }, [sync, refresh]);

  const signature = useMemo(
    () =>
      `${desk.things.length}:${desk.things
        .map((x) => `${x.updatedAt}${x.status}`)
        .join("|")}:${desk.alerts.length}`,
    [desk.things, desk.alerts.length],
  );
  const scheduleSync = sync.scheduleSync;
  useEffect(() => {
    if (!desk.ready) return;
    scheduleSync();
  }, [signature, desk.ready, scheduleSync]);

  const notified = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!desk.ready || !desk.settings.notifyUrgent) return;
    const urgent = desk.alerts.find((a) => a.priority === "urgent");
    if (!urgent) return;
    if (notifyUrgentAlert(urgent, notified.current)) {
      notified.current.add(urgent.id);
    }
  }, [desk.ready, desk.settings.notifyUrgent, desk.alerts]);

  const openThing = useCallback((thing: Thing) => {
    setEditId(null);
    setOpenId(thing.id);
  }, []);

  const startAdd = useCallback((preset?: EditorPreset) => {
    setQuickPreset(preset ?? null);
    setQuickOpen(true);
  }, []);

  const closeSheets = useCallback(() => {
    setQuickOpen(false);
    setQuickPreset(null);
    setOpenId(null);
    setEditId(null);
  }, []);

  async function saveNew(values: ReturnType<typeof fromEditorValues>) {
    setBusy(true);
    const thing = await desk.addThing(values);
    setBusy(false);
    closeSheets();
    showToast(t("thing.savedToast", { name: thing.name }), "ok");
  }

  async function saveEdit(values: ReturnType<typeof fromEditorValues>) {
    const target = desk.things.find((x) => x.id === editId);
    if (!target) return;
    setBusy(true);
    await desk.updateThing(target, values);
    setBusy(false);
    setEditId(null);
    showToast(t("thing.savedToast", { name: values.name }), "ok");
  }

  async function handleThing(thing: Thing) {
    setBusy(true);
    await desk.completeThing(thing);
    setBusy(false);
    setOpenId(null);
    showToast(t("thing.handledToast"), "ok");
  }

  const recovering = auth.passwordResetReady;
  const route: Route | null = recovering
    ? { kind: "auth" }
    : (stack[stack.length - 1] ?? null);
  const open = openId ? desk.things.find((x) => x.id === openId) ?? null : null;
  const editing = editId ? desk.things.find((x) => x.id === editId) ?? null : null;

  return (
    <div className="app" lang={desk.settings.locale}>
      <div className="app__col">
        <Header
          desk={desk}
          tab={tab}
          route={route}
          canGoBack={!recovering}
          onBack={pop}
          onOpenNotifications={() => push({ kind: "notifications" })}
          onOpenProfile={() => {
            setStack([]);
            setTab("profile");
          }}
        />

        <main className="app__body">
          {desk.error ? (
            <div style={{ marginBottom: "0.875rem" }}>
              <div className="notice notice--danger">
                <Icon name="alert" size={18} className="notice__icon" />
                <div className="notice__body">
                  <strong>{t("app.error.title")}</strong>
                  <br />
                  {desk.error}
                </div>
              </div>
            </div>
          ) : null}

          {route?.kind === "module" ? (
            <ModuleHeader
              id={route.id}
              t={t}
              count={desk.things.filter((x) => x.status === "active").length}
            />
          ) : null}

          {route?.kind === "module" ? (
            <ModuleScreen
              module={route.id}
              things={desk.things}
              t={t}
              onOpenThing={(thing) => {
                setStack([]);
                setTab("things");
                openThing(thing);
              }}
            />
          ) : route?.kind === "notifications" ? (
            <NotificationsScreen
              desk={desk}
              onOpenThing={openThing}
              onAdd={() => startAdd()}
            />
          ) : route?.kind === "auth" ? (
            <AuthScreen
              t={t}
              auth={auth}
              onClose={pop}
              onDone={(message) => showToast(message, "ok")}
            />
          ) : tab === "home" ? (
            <HomeScreen
              desk={desk}
              onOpenThing={openThing}
              onAdd={startAdd}
              onAddMore={() => startAdd()}
              onOpenModule={(id) => push({ kind: "module", id })}
              onOpenNotifications={() => push({ kind: "notifications" })}
              onOpenCalendar={() => {
                setStack([]);
                setTab("calendar");
              }}
              onOpenThings={() => {
                setStack([]);
                setTab("things");
              }}
            />
          ) : tab === "things" ? (
            <ThingsScreen desk={desk} onOpenThing={openThing} onAdd={() => startAdd()} />
          ) : tab === "calendar" ? (
            <CalendarScreen desk={desk} onOpenThing={openThing} onAdd={() => startAdd()} />
          ) : tab === "services" ? (
            <ServicesScreen
              desk={desk}
              onOpenModule={(id) => push({ kind: "module", id })}
              onOpenThing={openThing}
              onAddProvider={() =>
                startAdd({ label: t("kind.service-provider"), kind: "service-provider", category: "services" })
              }
              onAdd={() => startAdd()}
            />
          ) : (
            <ProfileScreen
              desk={desk}
              auth={auth}
              sync={sync}
              onOpenAuth={() => push({ kind: "auth" })}
              onOpenConfirmDeleteAll={() => setConfirmWipe(true)}
              showToast={showToast}
            />
          )}
        </main>

        <nav className="bottomnav" aria-label={t("nav.primary")}>
          {TABS.map((def) => (
            <button
              key={def.id}
              type="button"
              className={
                def.id === tab && !route ? "navitem navitem--on" : "navitem"
              }
              onClick={() => {
                setStack([]);
                setTab(def.id);
              }}
              aria-current={def.id === tab && !route ? "page" : undefined}
            >
              <span className="navitem__icon">
                <Icon name={def.icon} size={21} />
              </span>
              <span className="navitem__label">{t(def.labelKey)}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="fab"
          onClick={() => startAdd()}
          aria-label={t("qa.title")}
        >
          <Icon name="plus" size={26} strokeWidth={2.1} />
        </button>
      </div>

      <DesktopRail desk={desk} tab={tab} onOpenThing={openThing} />

      {/* ---------------------------------------------------------- sheets */}

      <Toast toast={toast} />

      {quickOpen ? (
        <QuickAddSheet
          t={t}
          busy={busy}
          initial={quickPreset ?? undefined}
          initialCategory={quickPreset?.category}
          onClose={closeSheets}
          onSave={(values) => void saveNew(values)}
        />
      ) : null}

      {editing ? (
        <QuickAddEditHost
          thing={editing}
          t={t}
          busy={busy}
          onCancel={() => setEditId(null)}
          onSave={(values) => void saveEdit(values)}
        />
      ) : null}

      {open && !editing ? (
        <ThingDetailSheet
          thing={open}
          t={t}
          leadDays={desk.settings.leadDays}
          busy={busy}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditId(open.id)}
          onDelete={() => setConfirmThing(open.id)}
          onHandle={() => void handleThing(open)}
        />
      ) : null}

      {confirmThing ? (
        <ConfirmDialog
          title={t("thing.deleteTitle")}
          message={t("thing.deleteBody")}
          confirmLabel={t("things.delete")}
          cancelLabel={t("ed.cancel")}
          destructive
          onCancel={() => setConfirmThing(null)}
          onConfirm={() => {
            const target = desk.things.find((x) => x.id === confirmThing);
            setConfirmThing(null);
            setOpenId(null);
            if (!target) return;
            void desk.removeThing(target.id);
            showToast(t("thing.deletedToast"), "info");
          }}
        />
      ) : null}

      {confirmWipe ? (
        <ConfirmDialog
          title={t("profile.deleteAll")}
          message={t("profile.confirmDeleteAll")}
          confirmLabel={t("profile.deleteAll")}
          cancelLabel={t("ed.cancel")}
          destructive
          onCancel={() => setConfirmWipe(false)}
          onConfirm={() => {
            setConfirmWipe(false);
            void desk.deleteEverything();
            showToast(t("thing.deletedToast"), "info");
            window.location.reload();
          }}
        />
      ) : null}
      <InstallPrompt />
    </div>
  );
}