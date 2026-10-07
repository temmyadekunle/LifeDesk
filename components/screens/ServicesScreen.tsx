"use client";

import { useMemo } from "react";

import { Icon } from "../Icons";
import { EmptyState, IconTile } from "../ui";
import { CATEGORY_META, MODULE_ICON, MODULES, moduleThings, type ModuleId } from "../maps";
import { TINT_SOFT, tint } from "@/lib/color";
import type { Category, Thing } from "@/lib/types";
import type { useLivanta } from "@/lib/useLivanta";

type Desk = ReturnType<typeof useLivanta>;

export function ServicesScreen({
  desk,
  onOpenModule,
  onOpenThing,
  onAddProvider,
  onAdd,
}: {
  desk: Desk;
  onOpenModule: (id: ModuleId) => void;
  onOpenThing: (thing: Thing) => void;
  onAddProvider: () => void;
  onAdd: () => void;
}) {
  const { t } = desk;

  const counts = useMemo(() => {
    const out = {} as Record<ModuleId, number>;
    for (const m of MODULES) {
      out[m.id] = moduleThings(desk.things, m.id).length;
    }
    return out;
  }, [desk.things]);

  const providers = useMemo(
    () =>
      desk.things
        .filter((x) => x.kind === "service-provider" && x.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [desk.things],
  );

  return (
    <>
      <p className="card-meta" style={{ margin: "0 0 0.875rem" }}>
        {t("svc.blurb")}
      </p>

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section__head">
          <h2 className="section__title">{t("svc.areas")}</h2>
        </div>
        <div className="stack stack--tight">
          {MODULES.map((m) => (
            <button
              key={m.id}
              className="card"
              style={{ display: "flex", gap: "0.75rem", alignItems: "center", textAlign: "left", width: "100%" }}
              onClick={() => onOpenModule(m.id)}
            >
              <span
                className="module-ico"
                style={{ color: m.color, background: tint(m.color, TINT_SOFT), marginBottom: 0, flex: "none" }}
              >
                <Icon name={MODULE_ICON[m.id]} size={20} />
              </span>
              <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                <span className="module-label" style={{ display: "block" }}>
                  {t(m.labelKey)}
                </span>
                <span className="module-blurb">{t(m.blurbKey)}</span>
              </span>
              <span className="badge b-brand" style={{ flex: "none" }}>
                {counts[m.id]}
              </span>
              <Icon name="chevronRight" size={18} />
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("svc.providers")}</h2>
          <button className="section__link" onClick={onAddProvider}>
            <Icon name="plus" size={14} />
            {t("svc.addProvider")}
          </button>
        </div>

        {providers.length === 0 ? (
          <EmptyState
            icon="pin"
            title={t("svc.noProviders")}
            body={t("svc.noProvidersBody")}
            action={
              <button className="btn btn--soft" onClick={onAddProvider}>
                <Icon name="plus" size={18} />
                {t("svc.addProvider")}
              </button>
            }
          />
        ) : (
          <div className="list">
            {providers.map((p) => {
              const phone =
                typeof p.details.phone === "string" ? p.details.phone : null;
              const trade =
                typeof p.details.trade === "string" ? p.details.trade : null;
              return (
                <button
                  key={p.id}
                  className="listrow"
                  onClick={() => onOpenThing(p)}
                >
                  <IconTile icon="pin" color="var(--services)" size={18} />
                  <span className="listrow__body">
                    <span className="listrow__title">{p.name}</span>
                    <span className="listrow__sub">
                      {trade ?? t("kind.service-provider")}
                      {phone ? ` · ${phone}` : ""}
                    </span>
                  </span>
                  <span className="listrow__trail">
                    <Icon name="chevronRight" size={18} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">{t("svc.byCategory")}</h2>
        </div>
        <div className="grid grid--2">
          {(Object.keys(CATEGORY_META) as Category[]).map((id) => {
            const meta = CATEGORY_META[id];
            const count = desk.things.filter(
              (x) => x.status === "active" && x.category === id && x.kind !== "asset",
            ).length;
            return (
              <div key={id} className="card card--quiet">
                <div className="rowline">
                  <IconTile icon={meta.icon} color={meta.color} size={18} />
                  <div className="listrow__body">
                    <p className="listrow__title">{t(meta.labelKey)}</p>
                    <p className="listrow__sub">{t.n("svc.items", count)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn btn--secondary btn--block" style={{ marginTop: "0.625rem" }} onClick={onAdd}>
          <Icon name="plus" size={18} />
          {t("home.quickAdd")}
        </button>
      </section>
    </>
  );
}