"use client";

import { useMemo, useState } from "react";

import { Icon } from "../Icons";
import { AlertCard, ThingLine } from "./HomeScreen";
import { EmptyState } from "../ui";
import { CATEGORIES, CATEGORY_META } from "../maps";
import type { Category, Thing } from "@/lib/types";
import type { TKey } from "@/lib/locales/en";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;
type CatFilter = "all" | Category;

/* The filter row reads the way the brief phrases it — Bills, Vehicles —
   rather than the raw category names (Money, Transport). Filtering itself is
   unchanged: the chip still selects its category. */
const FILTER_LABEL: Record<Category, TKey> = {
  home: "cat.home",
  transport: "module.vehicles",
  money: "module.bills",
  documents: "module.documents",
  family: "cat.family",
  tasks: "cat.tasks",
  services: "cat.services",
};

export function AlertsScreen({
  desk,
  onOpenThing,
  onAdd,
}: {
  desk: Desk;
  onOpenThing: (thing: Thing) => void;
  onAdd: () => void;
}) {
  const { t } = desk;
  const [category, setCategory] = useState<CatFilter>("all");

  const attention = useMemo(
    () =>
      desk.alerts.filter((a) =>
        category === "all" ? true : a.category === category,
      ),
    [desk.alerts, category],
  );

  const upcoming = useMemo(() => {
    const alerted = new Set(desk.alerts.map((a) => a.thingId));
    return desk.totals.items.filter(
      (x) =>
        !alerted.has(x.id) &&
        (category === "all" ? true : x.category === category),
    );
  }, [desk.totals.items, desk.alerts, category]);

  const completed = useMemo(
    () =>
      desk.things
        .filter(
          (x) =>
            x.status === "completed" &&
            (category === "all" ? true : x.category === category),
        )
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")),
    [desk.things, category],
  );

  const nothingAtAll =
    attention.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <>
      <div
        className="chips"
        role="group"
        aria-label={t("things.statusFilter")}
        style={{ marginTop: "1rem" }}
      >
        <button
          className={category === "all" ? "chip chip--on" : "chip"}
          onClick={() => setCategory("all")}
          aria-pressed={category === "all"}
        >
          {t("things.filterAll")}
        </button>
        {CATEGORIES.map((id) => {
          const meta = CATEGORY_META[id];
          return (
            <button
              key={id}
              className={category === id ? "chip chip--on" : "chip"}
              onClick={() => setCategory(id)}
              aria-pressed={category === id}
              style={
                category === id
                  ? undefined
                  : { color: meta.color, borderColor: `${meta.color}44` }
              }
            >
              <Icon name={meta.icon} size={15} />
              {t(FILTER_LABEL[id])}
            </button>
          );
        })}
      </div>

      {nothingAtAll && desk.things.length === 0 ? (
        <section className="section">
          <EmptyState
            icon="sparkles"
            title={t("home.freshTitle")}
            body={t("home.freshBody")}
            action={
              <button className="btn btn--soft" onClick={onAdd}>
                <Icon name="plus" size={18} />
                {t("home.freshAction")}
              </button>
            }
          />
        </section>
      ) : nothingAtAll ? (
        <section className="section">
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
        </section>
      ) : (
        <>
          <section className="section" style={{ marginBottom: 0 }}>
            <div className="section__head">
              <h2 className="section__title">{t("alerts.needsAttention")}</h2>
              {desk.alerts.length > 0 ? (
                <button
                  className="section__link"
                  onClick={() => void desk.restoreAlerts()}
                >
                  <Icon name="refresh" size={14} />
                  {t("alerts.restoreShort")}
                </button>
              ) : null}
            </div>
            {attention.length === 0 ? (
              <QuietEmpty title={t("alerts.emptyTitle")} />
            ) : (
              <div className="stack stack--tight">
                {attention.map((a) => (
                  <AlertCard key={a.id} alert={a} desk={desk} onOpen={onOpenThing} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">{t("alerts.comingUp")}</h2>
            </div>
            {upcoming.length === 0 ? (
              <QuietEmpty title={t("home.nothing30Title")} />
            ) : (
              <div className="list">
                {upcoming.map((thing) => (
                  <ThingLine
                    key={thing.id}
                    thing={thing}
                    desk={desk}
                    onOpen={onOpenThing}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section__head">
              <h2 className="section__title">{t("alerts.completed")}</h2>
            </div>
            {completed.length === 0 ? (
              <QuietEmpty
                title={t("alerts.completedEmptyTitle")}
                body={t("alerts.completedEmptyBody")}
              />
            ) : (
              <div className="list">
                {completed.map((thing) => (
                  <ThingLine
                    key={thing.id}
                    thing={thing}
                    desk={desk}
                    onOpen={onOpenThing}
                  />
                ))}
              </div>
            )}
          </section>

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

function QuietEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card card--quiet">
      <p className="listrow__title" style={{ whiteSpace: "normal" }}>
        {title}
      </p>
      {body ? (
        <p className="listrow__sub" style={{ whiteSpace: "normal", marginTop: "0.25rem" }}>
          {body}
        </p>
      ) : null}
    </div>
  );
}
