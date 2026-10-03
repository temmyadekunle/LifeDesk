"use client";

import {
  summariseAssets,
  summariseBills,
  summariseDocuments,
  summariseHome,
  summariseVehicles,
} from "@/lib/modules";
import { daysUntil } from "@/lib/risk";
import { formatNaira, type Translate } from "@/lib/i18n";
import type { TKey } from "@/lib/locales/en";
import type { Thing } from "@/lib/types";

export type ModuleId =
  | "home"
  | "vehicles"
  | "bills"
  | "documents"
  | "assets";

export const MODULES: {
  id: ModuleId;
  labelKey: TKey;
  blurbKey: TKey;
  ico: string;
  color: string;
}[] = [
  {
    id: "home",
    labelKey: "module.home",
    blurbKey: "module.home.blurb",
    ico: "🏠",
    color: "var(--home)",
  },
  {
    id: "vehicles",
    labelKey: "module.vehicles",
    blurbKey: "module.vehicles.blurb",
    ico: "🚗",
    color: "var(--transport)",
  },
  {
    id: "bills",
    labelKey: "module.bills",
    blurbKey: "module.bills.blurb",
    ico: "💳",
    color: "var(--money)",
  },
  {
    id: "documents",
    labelKey: "module.documents",
    blurbKey: "module.documents.blurb",
    ico: "📄",
    color: "var(--documents)",
  },
  {
    id: "assets",
    labelKey: "module.assets",
    blurbKey: "module.assets.blurb",
    ico: "📦",
    color: "var(--assets)",
  },
];

export default function ModuleScreen({
  module,
  things,
  onOpenThing,
  t,
}: {
  module: ModuleId;
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  switch (module) {
    case "home":
      return <HomeModule things={things} onOpenThing={onOpenThing} t={t} />;
    case "vehicles":
      return <VehiclesModule things={things} onOpenThing={onOpenThing} t={t} />;
    case "bills":
      return <BillsModule things={things} onOpenThing={onOpenThing} t={t} />;
    case "documents":
      return <DocumentsModule things={things} onOpenThing={onOpenThing} t={t} />;
    case "assets":
      return <AssetsModule things={things} onOpenThing={onOpenThing} t={t} />;
  }
}

function Row({
  thing,
  onOpen,
  right,
}: {
  thing: Thing;
  onOpen: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button className="row-btn" onClick={onOpen}>
      <div className="row">
        <span className="grow">
          <div className="name">{thing.name}</div>
          {thing.notes && <div className="sub">{thing.notes}</div>}
        </span>
        {right}
      </div>
    </button>
  );
}

function HomeModule({
  things,
  onOpenThing,
  t,
}: {
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  const s = summariseHome(things);

  return (
    <>
      <section className="card">
        <p className="section-label">{t("mod.properties")}</p>
        {s.properties.map((p) => (
          <div key={p.id}>
            <Row
              thing={p}
              onOpen={() => onOpenThing(p)}
              right={
                p.amount ? (
                  <span className="sub">{formatNaira(p.amount)}</span>
                ) : undefined
              }
            />
            {typeof p.details.landlord === "string" && (
              <p className="sub" style={{ padding: "0 0 10px" }}>
                {t("mod.landlord")}: {p.details.landlord}
                {typeof p.details.serviceCharge === "number"
                  ? ` · ${t("mod.serviceCharge")} ${formatNaira(p.details.serviceCharge)}`
                  : ""}
              </p>
            )}
          </div>
        ))}
        {s.properties.length === 0 && (
          <p className="card-meta">{t("mod.noProperty")}</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">{t("mod.homeMaintenance")}</p>
        {s.overdueMaintenance.length > 0 && (
          <p className="card-meta" style={{ marginBottom: 10 }}>
            {t.n("mod.needServicing", s.overdueMaintenance.length)}
          </p>
        )}
        {s.maintenance.map((m) => (
          <Row
            key={m.id}
            thing={m}
            onOpen={() => onOpenThing(m)}
            right={
              m.lastHandledDate ? (
                <span className="sub">
                  {t("mod.daysAgo", {
                    n: Math.round(
                      (Date.now() - new Date(m.lastHandledDate).getTime()) /
                        86_400_000,
                    ),
                  })}
                </span>
              ) : undefined
            }
          />
        ))}
        {s.maintenance.length === 0 && (
          <p className="card-meta">{t("mod.nothingMaintenance")}</p>
        )}
      </section>

      <section className="card">
        <p className="section-label">{t("mod.next30")}</p>
        <div className="amount">{formatNaira(s.monthlyOutgoings)}</div>
        <p className="card-meta">{t("mod.knownOutgoings")}</p>
      </section>
    </>
  );
}

function VehiclesModule({
  things,
  onOpenThing,
  t,
}: {
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  const groups = summariseVehicles(things);

  if (groups.length === 0) {
    return (
      <section className="card">
        <p className="card-meta">{t("mod.noVehicles")}</p>
      </section>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <section className="card" key={g.name}>
          <p className="section-label">{g.name}</p>
          {g.serviceDue.length > 0 && (
            <p className="card-meta" style={{ marginBottom: 10 }}>
              {t.n("mod.serviceDue", g.serviceDue.length)}
            </p>
          )}
          {g.nextDue && (
            <p className="card-meta" style={{ marginBottom: 10 }}>
              {t("mod.nextDue", { name: g.nextDue.name })}
              {g.nextDue.dueDate
                ? t("mod.nextDueIn", {
                    n: Math.max(0, daysUntil(g.nextDue.dueDate)),
                  })
                : ""}
              .
            </p>
          )}
          {g.things.map((item) => (
            <Row
              key={item.id}
              thing={item}
              onOpen={() => onOpenThing(item)}
              right={
                item.amount ? (
                  <span className="sub">{formatNaira(item.amount)}</span>
                ) : (
                  <span className="sub">
                    {t(`kind.${item.kind}` as TKey)}
                  </span>
                )
              }
            />
          ))}
          <p className="sub" style={{ paddingTop: 10 }}>
            {t("mod.recordedSpend", { amount: formatNaira(g.totalSpend) })}
          </p>
        </section>
      ))}
    </>
  );
}

function BillsModule({
  things,
  onOpenThing,
  t,
}: {
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  const s = summariseBills(things);

  return (
    <>
      <section className="card">
        <p className="section-label">{t("mod.next30")}</p>
        <div className="amount">{formatNaira(s.next30Total)}</div>
        <p className="card-meta">
          {t.n("mod.recurringCount", s.recurring.length)}
          {t("mod.perCycle", { amount: formatNaira(s.recurringTotal) })}
        </p>
      </section>

      {s.largest && (
        <section className="card alert-soon">
          <p className="section-label">{t("mod.largestCommitment")}</p>
          <h3 className="card-title">{s.largest.name}</h3>
          <p className="card-meta">{formatNaira(s.largest.amount ?? 0)}</p>
        </section>
      )}

      <section className="card">
        <p className="section-label">{t("mod.recurringPayments")}</p>
        {s.recurring.map((item) => (
          <Row
            key={item.id}
            thing={item}
            onOpen={() => onOpenThing(item)}
            right={
              <span className="sub">
                {item.amount ? formatNaira(item.amount) : ""}{" "}
                {item.dueDate ? `· ${daysUntil(item.dueDate)}d` : ""}
              </span>
            }
          />
        ))}
        {s.recurring.length === 0 && (
          <p className="card-meta">{t("mod.noRecurring")}</p>
        )}
      </section>

      {s.oneOff.length > 0 && (
        <section className="card">
          <p className="section-label">{t("mod.oneOffPayments")}</p>
          {s.oneOff.map((item) => (
            <Row
              key={item.id}
              thing={item}
              onOpen={() => onOpenThing(item)}
              right={
                item.amount ? (
                  <span className="sub">{formatNaira(item.amount)}</span>
                ) : undefined
              }
            />
          ))}
        </section>
      )}
    </>
  );
}

function DocumentsModule({
  things,
  onOpenThing,
  t,
}: {
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  const s = summariseDocuments(things);

  const group = (labelKey: TKey, list: Thing[], tone?: string) =>
    list.length > 0 && (
      <section className={`card ${tone ?? ""}`} key={labelKey}>
        <p className="section-label">{t(labelKey)}</p>
        {list.map((item) => (
          <Row
            key={item.id}
            thing={item}
            onOpen={() => onOpenThing(item)}
            right={
              item.dueDate ? (
                <span className="sub">{t("mod.daysLeft", { n: daysUntil(item.dueDate) })}</span>
              ) : undefined
            }
          />
        ))}
      </section>
    );

  const total =
    s.expiringSoon.length + s.thisYear.length + s.later.length + s.noExpiry.length;

  return (
    <>
      {group("mod.expiringSoon", s.expiringSoon, "alert-soon")}
      {group("mod.thisYear", s.thisYear)}
      {group("mod.later", s.later)}
      {group("mod.noExpiryRecorded", s.noExpiry)}
      {total === 0 && (
        <section className="card">
          <p className="card-meta">{t("mod.noDocuments")}</p>
        </section>
      )}
    </>
  );
}

function AssetsModule({
  things,
  onOpenThing,
  t,
}: {
  things: Thing[];
  onOpenThing: (thing: Thing) => void;
  t: Translate;
}) {
  const s = summariseAssets(things);

  if (s.rows.length === 0) {
    return (
      <section className="card">
        <p className="card-meta">{t("mod.noAssets")}</p>
      </section>
    );
  }

  const badge = (state?: string) =>
    state === "expired" ? (
      <span className="badge b-urgent">{t("mod.expired")}</span>
    ) : state === "expiring" ? (
      <span className="badge b-important">{t("mod.expiring")}</span>
    ) : (
      <span className="badge b-upcoming">{t("mod.covered")}</span>
    );

  return (
    <>
      <section className="card">
        <p className="section-label">{t("mod.portfolio")}</p>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-num routine">{s.covered.length}</div>
            <div className="stat-label">{t("mod.covered")}</div>
          </div>
          <div className="stat">
            <div className="stat-num important">{s.expiring.length}</div>
            <div className="stat-label">{t("mod.expiring")}</div>
          </div>
          <div className="stat">
            <div className="stat-num urgent">{s.expired.length}</div>
            <div className="stat-label">{t("mod.expired")}</div>
          </div>
        </div>
        <p className="sub" style={{ paddingTop: 10 }}>
          {t("mod.totalValue", { amount: formatNaira(s.totalValue) })}
        </p>
      </section>

      {s.expired.length > 0 && (
        <section className="card alert-urgent">
          <p className="section-label">{t("mod.warrantyExpired")}</p>
          {s.expired.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={badge(r.warranty?.state)}
            />
          ))}
        </section>
      )}

      {s.expiring.length > 0 && (
        <section className="card alert-soon">
          <p className="section-label">{t("mod.expiringSoon")}</p>
          {s.expiring.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={
                <span className="sub">
                  {t("mod.daysLeft", { n: r.warranty?.daysLeft ?? 0 })}
                </span>
              }
            />
          ))}
        </section>
      )}

      {s.covered.length > 0 && (
        <section className="card accent-teal">
          <p className="section-label">{t("mod.underWarranty")}</p>
          {s.covered.map((r) => (
            <Row
              key={r.thing.id}
              thing={r.thing}
              onOpen={() => onOpenThing(r.thing)}
              right={badge(r.warranty?.state)}
            />
          ))}
        </section>
      )}

      {s.rows.filter((r) => !r.warranty).length > 0 && (
        <section className="card">
          <p className="section-label">{t("mod.noWarranty")}</p>
          {s.rows
            .filter((r) => !r.warranty)
            .map((r) => (
              <Row
                key={r.thing.id}
                thing={r.thing}
                onOpen={() => onOpenThing(r.thing)}
              />
            ))}
        </section>
      )}
    </>
  );
}