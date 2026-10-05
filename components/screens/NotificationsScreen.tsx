"use client";

import { Icon } from "../Icons";
import { AlertCard } from "./HomeScreen";
import { EmptyState } from "../ui";
import type { Thing } from "@/lib/types";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;

export function NotificationsScreen({
  desk,
  onOpenThing,
  onAdd,
}: {
  desk: Desk;
  onOpenThing: (thing: Thing) => void;
  onAdd: () => void;
}) {
  const { t } = desk;

  return (
    <>
      {desk.alerts.length === 0 ? (
        <EmptyState
          icon="shieldCheck"
          title={t("alerts.emptyTitle")}
          body={t("alerts.emptyBody")}
          action={
            <div className="quick-grid">
              <button className="btn btn--soft" onClick={onAdd}>
                <Icon name="plus" size={18} />
                {t("home.quickAdd")}
              </button>
              <button
                className="btn btn--secondary"
                onClick={() => void desk.restoreAlerts()}
              >
                <Icon name="refresh" size={18} />
                {t("alerts.restore")}
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="section__head" style={{ marginBottom: "0.625rem" }}>
            <h2 className="section__title">
              {t.n("alerts.count", desk.alerts.length, { status: desk.status.label })}
            </h2>
            <button
              className="section__link"
              onClick={() => void desk.restoreAlerts()}
            >
              <Icon name="refresh" size={14} />
              {t("alerts.restoreShort")}
            </button>
          </div>

          <div className="stack stack--tight">
            {desk.alerts.map((a) => (
              <AlertCard key={a.id} alert={a} desk={desk} onOpen={onOpenThing} />
            ))}
          </div>

          <div className="section">
            <button className="btn btn--soft btn--block" onClick={onAdd}>
              <Icon name="plus" size={18} />
              {t("home.quickAdd")}
            </button>
          </div>
        </>
      )}
    </>
  );
}