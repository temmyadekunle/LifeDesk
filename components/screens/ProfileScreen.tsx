"use client";

import { useMemo, useSyncExternalStore } from "react";

import { Icon } from "../Icons";
import { Logo } from "../Logo";
import { AccountPanel } from "../AccountPanel";
import { initials } from "../labels";
import { LocalePicker } from "../Onboarding";
import {
  announcePermissionChange,
  downloadJson,
  exportPayload,
  leadDaysCrossed,
  notificationPermission,
  reminderCopy,
  requestNotificationPermission,
  serverPermissionSnapshot,
  subscribeToPermission,
} from "@/lib/notifications";
import type { Locale } from "@/lib/i18n";
import type { useAuth } from "@/lib/useAuth";
import type { useCloudSync } from "@/lib/useCloudSync";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;

const LEAD_CHOICES = [90, 60, 30, 14, 7, 1];

export function ProfileScreen({
  desk,
  auth,
  sync,
  onOpenAuth,
  onOpenConfirmDeleteAll,
  showToast,
}: {
  desk: Desk;
  auth: ReturnType<typeof useAuth>;
  sync: ReturnType<typeof useCloudSync>;
  onOpenAuth: () => void;
  onOpenConfirmDeleteAll: () => void;
  showToast: (text: string, tone?: "ok" | "info" | "danger") => void;
}) {
  const { t } = desk;
  const permission = useSyncExternalStore(
    subscribeToPermission,
    notificationPermission,
    serverPermissionSnapshot,
  );
  const name = desk.settings.displayName || "Temmy";

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
      <section className="section" style={{ marginTop: 0 }}>
        <div className="profile-id">
          <Logo variant="wordmark" />
          <p className="profile-id__tag">{t("app.tagline")}</p>
        </div>
        <div className="card">
          <div className="rowline">
            <span className="avatar avatar--lg">{initials(name)}</span>
            <div className="listrow__body">
              <h2 className="card-title" style={{ fontSize: "1.0625rem" }}>
                {name}
              </h2>
              <p className="card-meta">{t("profile.freePlan")}</p>
            </div>
          </div>
          <div className="statgrid" style={{ marginTop: "0.875rem" }}>
            <MiniStat n={desk.things.filter((x) => x.status === "active").length} label={t("prof.active")} />
            <MiniStat n={desk.things.filter((x) => x.status === "completed").length} label={t("prof.completed")} />
            <MiniStat n={desk.alerts.length} label={t("tab.alerts")} />
          </div>
        </div>
      </section>

      {auth.enabled ? (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">{t("account.title")}</h2>
          </div>
          <button className="setrow" style={{ borderRadius: "var(--radius)" }} onClick={onOpenAuth}>
            <span className="listrow__lead" style={{ color: "var(--brand-700)" }}>
              <Icon name="cloud" size={19} />
            </span>
            <span className="setrow__body">
              <span className="setrow__title">
                {auth.status === "signed-in"
                  ? t("prof.signedIn")
                  : t("prof.manageAccount")}
              </span>
              <span className="setrow__sub">
                {auth.status === "signed-in"
                  ? auth.user?.email ?? ""
                  : t("prof.manageAccountSub")}
              </span>
            </span>
            <span className="setrow__trail">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        </section>
      ) : (
        <AccountPanel t={t} auth={auth} sync={sync} />
      )}

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("profile.language")}</h2>
        </div>
        <div className="card">
          <LocalePicker
            locale={desk.settings.locale}
            t={t}
            onChange={(locale: Locale) => void desk.updateSettings({ locale })}
          />
          <p className="card-meta" style={{ marginTop: "0.5rem" }}>
            {t("profile.languageHint")}
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("profile.notifications")}</h2>
        </div>
        <div className="list">
          {permission === "unsupported" ? (
            <div className="setrow">
              <span className="setrow__sub">{t("profile.notifUnsupported")}</span>
            </div>
          ) : null}
          {permission === "default" ? (
            <button
              className="setrow"
              onClick={async () => {
                await requestNotificationPermission();
                announcePermissionChange();
              }}
            >
              <span className="setrow__body">
                <span className="setrow__title">{t("profile.enableAlerts")}</span>
              </span>
              <span className="setrow__trail">
                <Icon name="chevronRight" size={18} />
              </span>
            </button>
          ) : null}
          {permission === "granted" ? (
            <div className="setrow">
              <span className="setrow__lead" style={{ color: "var(--ok)" }}>
                <Icon name="checkCircle" size={18} />
              </span>
              <span className="setrow__body">
                <span className="setrow__sub">{t("profile.notifGranted")}</span>
              </span>
            </div>
          ) : null}
          {permission === "denied" ? (
            <div className="setrow">
              <span className="setrow__lead" style={{ color: "var(--warn)" }}>
                <Icon name="alert" size={18} />
              </span>
              <span className="setrow__body">
                <span className="setrow__sub">{t("profile.notifDenied")}</span>
              </span>
            </div>
          ) : null}

          <label className="setrow">
            <span className="setrow__body">
              <span className="setrow__title">{t("profile.notifyUrgent")}</span>
            </span>
            <input
              type="checkbox"
              checked={desk.settings.notifyUrgent}
              onChange={(e) => void desk.updateSettings({ notifyUrgent: e.target.checked })}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("profile.reminderSchedule")}</h2>
        </div>
        <div className="card">
          <div className="chips">
            {LEAD_CHOICES.map((n) => (
              <button
                key={n}
                className={
                  desk.settings.leadDays.includes(n) ? "chip chip--on" : "chip chip--quiet"
                }
                onClick={() =>
                  void desk.updateSettings({
                    leadDays: desk.settings.leadDays.includes(n)
                      ? desk.settings.leadDays.filter((d) => d !== n)
                      : [...desk.settings.leadDays, n].sort((a, b) => b - a),
                  })
                }
              >
                {t("prof.daysShort", { n })}
              </button>
            ))}
          </div>
          {upcoming.length > 0 ? (
            <div style={{ marginTop: "0.875rem" }}>
              <p className="section-label">{t("profile.preview")}</p>
              {upcoming.map(({ thing, leads }) => {
                const copy = reminderCopy(thing, leads[0], t);
                return (
                  <div className="row" key={thing.id}>
                    <span className="grow">
                      <span className="name" style={{ display: "block" }}>
                        {copy.title}
                      </span>
                      <span className="sub" style={{ display: "block" }}>
                        {copy.body}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("profile.data")}</h2>
        </div>
        <div className="list">
          <label className="setrow">
            <span className="setrow__body">
              <span className="setrow__title">{t("profile.dataSaver")}</span>
              <span className="setrow__sub">{t("profile.dataSaverHint")}</span>
            </span>
            <input
              type="checkbox"
              checked={desk.settings.dataSaver}
              onChange={(e) => void desk.updateSettings({ dataSaver: e.target.checked })}
            />
          </label>
          <button
            className="setrow"
            onClick={() => {
              downloadJson("livanta-export.json", exportPayload(desk.things, desk.settings));
              showToast(t("profile.exportDone"), "ok");
            }}
          >
            <span className="listrow__lead">
              <Icon name="download" size={18} />
            </span>
            <span className="setrow__body">
              <span className="setrow__title">{t("profile.export")}</span>
            </span>
            <span className="setrow__trail">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
          <button
            className="setrow"
            onClick={() => {
              void desk.loadSampleData();
              showToast(t("profile.loadSample"), "ok");
            }}
          >
            <span className="listrow__lead">
              <Icon name="sparkles" size={18} />
            </span>
            <span className="setrow__body">
              <span className="setrow__title">{t("profile.loadSample")}</span>
            </span>
            <span className="setrow__trail">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("profile.yourData")}</h2>
        </div>
        <div className="card">
          <p className="card-meta">{t.n("profile.yourDataBody", desk.things.length)}</p>
          <button
            className="btn btn--danger btn--block"
            style={{ marginTop: "0.75rem" }}
            onClick={onOpenConfirmDeleteAll}
          >
            <Icon name="trash" size={18} />
            {t("profile.deleteAll")}
          </button>
        </div>
      </section>
    </>
  );
}

function MiniStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-num">{n}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}